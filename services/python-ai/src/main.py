"""
Referral Nova AI Microservice

Four engines:
1. Smart Matching — ML-based member matching using embeddings + collaborative filtering
2. Analytics Engine — referral pattern analysis, conversion predictions
3. NLP Pipeline — extract keywords, sentiment, topics from video transcripts + bios
4. Recommendation Engine — "members you should meet" based on behavior + profile similarity

Called by the Express API via HTTP. Runs as a standalone FastAPI service.
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import API_SECRET, PORT
from matching.smart_matcher import router as matching_router
from analytics.engine import router as analytics_router
from nlp.pipeline import router as nlp_router
from recommendations.engine import router as recommendations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[ai-service] Starting up — loading models...")
    # Models load lazily on first request
    yield
    print("[ai-service] Shutting down")


app = FastAPI(
    title="VPN AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def verify_secret(x_ai_secret: str = Header(default="")):
    if x_ai_secret != API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid AI service secret")


# Every router requires the shared secret (X-AI-Secret header) - the Express
# API sends it. Without this the service exposed member PII to anyone who could
# reach it. If API_SECRET is unset (local dev), verify_secret still runs but an
# empty configured secret means the header must also be empty.
_auth = [Depends(verify_secret)]
app.include_router(matching_router, prefix="/matching", tags=["Matching"], dependencies=_auth)
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"], dependencies=_auth)
app.include_router(nlp_router, prefix="/nlp", tags=["NLP"], dependencies=_auth)
app.include_router(recommendations_router, prefix="/recommendations", tags=["Recommendations"], dependencies=_auth)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vpn-ai"}


if __name__ == "__main__":
    import uvicorn
    import os
    # reload is a dev-only convenience (file watcher); never in production.
    dev = os.environ.get("ENV", "production").lower() in ("dev", "development", "local")
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=dev)
