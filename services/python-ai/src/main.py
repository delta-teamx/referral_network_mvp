"""
Referral Nova AI Microservice

Four engines:
1. Smart Matching — ML-based member matching using embeddings + collaborative filtering
2. Analytics Engine — referral pattern analysis, conversion predictions
3. NLP Pipeline — extract keywords, sentiment, topics from video transcripts + bios
4. Recommendation Engine — "members you should meet" based on behavior + profile similarity

Called by the Express API via HTTP. Runs as a standalone FastAPI service.
"""

from fastapi import FastAPI, HTTPException, Header
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


app.include_router(matching_router, prefix="/matching", tags=["Matching"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(nlp_router, prefix="/nlp", tags=["NLP"])
app.include_router(recommendations_router, prefix="/recommendations", tags=["Recommendations"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vpn-ai"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
