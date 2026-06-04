"""
Smart Matching Engine — ML-based member matching

Uses sentence-transformers to create profile embeddings, then combines:
1. Cosine similarity on profile embeddings (semantic match)
2. ICP overlap scoring (explicit preferences)
3. Collaborative filtering (members who referred similar people)
4. Geographic proximity (Haversine distance)
5. Complementary industry boost (realtor + mortgage broker)

Returns ranked match list with confidence scores and reasoning.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import numpy as np
from functools import lru_cache

router = APIRouter()

# Lazy-load the sentence transformer model
_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[matching] Loaded sentence-transformers model")
    return _model


class MatchRequest(BaseModel):
    userId: str
    limit: int = 10
    excludeMetRecently: bool = True


class MatchResult(BaseModel):
    targetUserId: str
    targetName: str
    targetBusiness: str
    targetIndustry: str
    score: float
    reasons: list[str]
    breakdown: dict


@router.post("/smart-match")
async def smart_match(req: MatchRequest) -> dict:
    """Find the best matches for a member using ML + rules."""
    from shared.db import get_members, get_interactions, get_meeting_history

    members = get_members()
    interactions = get_interactions()

    user = next((m for m in members if m["userId"] == req.userId), None)
    if not user:
        return {"matches": [], "error": "User not found"}

    candidates = [m for m in members if m["userId"] != req.userId]

    # Filter out recently met if requested
    if req.excludeMetRecently:
        history = get_meeting_history()
        met_set = set()
        for h in history:
            if h["userAId"] == req.userId:
                met_set.add(h["userBId"])
            if h["userBId"] == req.userId:
                met_set.add(h["userAId"])
        candidates = [c for c in candidates if c["userId"] not in met_set]

    if not candidates:
        return {"matches": []}

    # Score each candidate
    scored = []
    for candidate in candidates:
        score, reasons, breakdown = compute_match_score(user, candidate, interactions)
        scored.append({
            "targetUserId": candidate["userId"],
            "targetName": f"{candidate['firstName']} {candidate['lastName']}",
            "targetBusiness": candidate["businessName"],
            "targetIndustry": candidate["industry"],
            "score": round(score, 2),
            "reasons": reasons,
            "breakdown": breakdown,
        })

    # Sort by score descending, take top N
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"matches": scored[:req.limit]}


def compute_match_score(user: dict, candidate: dict, interactions: dict) -> tuple:
    """Compute a 0-100 match score with reasoning."""
    score = 0.0
    reasons = []
    breakdown = {}

    # 1. ICP Overlap (0-30 points)
    icp_score = icp_overlap(user, candidate)
    score += icp_score
    breakdown["icp_overlap"] = round(icp_score, 1)
    if icp_score > 15:
        reasons.append(f"Strong ICP alignment — they want to meet people in your industry")

    # 2. Referral Complementarity (0-25 points)
    ref_score = referral_complementarity(user, candidate)
    score += ref_score
    breakdown["referral_match"] = round(ref_score, 1)
    if ref_score > 12:
        reasons.append(f"Can refer clients to each other")

    # 3. Semantic Profile Similarity (0-20 points)
    sem_score = semantic_similarity(user, candidate)
    score += sem_score
    breakdown["semantic_similarity"] = round(sem_score, 1)

    # 4. Collaborative Signal (0-15 points)
    collab_score = collaborative_score(user, candidate, interactions)
    score += collab_score
    breakdown["collaborative_signal"] = round(collab_score, 1)
    if collab_score > 8:
        reasons.append("Members like you frequently connect with members like them")

    # 5. Geographic Proximity (0-10 points)
    geo_score = geographic_score(user, candidate)
    score += geo_score
    breakdown["geographic"] = round(geo_score, 1)
    if geo_score > 5:
        reasons.append(f"Same area: {candidate.get('city', '')}, {candidate.get('state', '')}")

    # Bonus: Industry diversity (different but complementary)
    if user["industry"].lower() != candidate["industry"].lower():
        score += 5
        breakdown["industry_diversity"] = 5
        if not reasons:
            reasons.append(f"Complementary industry: {candidate['industry']}")

    # Bonus: Premium members get slight boost (they're invested)
    if candidate.get("subscriptionTier") in ("PRO", "PREMIUM"):
        score += 3
        breakdown["tier_boost"] = 3

    if not reasons:
        reasons.append(f"Potential networking match in {candidate['industry']}")

    return min(score, 100), reasons, breakdown


def icp_overlap(user: dict, candidate: dict) -> float:
    """Score based on how well each matches the other's Ideal Client Profile."""
    score = 0.0
    user_icp = set(i.lower() for i in (user.get("icpIndustries") or []))
    cand_icp = set(i.lower() for i in (candidate.get("icpIndustries") or []))
    user_ind = user.get("industry", "").lower()
    cand_ind = candidate.get("industry", "").lower()

    # User wants to meet people in candidate's industry
    if cand_ind and cand_ind in user_icp:
        score += 15
    # Candidate wants to meet people in user's industry
    if user_ind and user_ind in cand_icp:
        score += 15
    return score


def referral_complementarity(user: dict, candidate: dict) -> float:
    """Score based on ability to refer clients to each other."""
    score = 0.0
    user_can_refer = set(i.lower() for i in (user.get("canReferIndustries") or []))
    cand_can_refer = set(i.lower() for i in (candidate.get("canReferIndustries") or []))
    user_ind = user.get("industry", "").lower()
    cand_ind = candidate.get("industry", "").lower()

    if cand_ind and cand_ind in user_can_refer:
        score += 12.5
    if user_ind and user_ind in cand_can_refer:
        score += 12.5
    return score


def semantic_similarity(user: dict, candidate: dict) -> float:
    """Cosine similarity between profile text embeddings."""
    try:
        model = get_model()
        user_text = build_profile_text(user)
        cand_text = build_profile_text(candidate)

        embeddings = model.encode([user_text, cand_text], normalize_embeddings=True)
        similarity = float(np.dot(embeddings[0], embeddings[1]))
        return max(0, similarity * 20)  # Scale to 0-20
    except Exception:
        return 0.0


def build_profile_text(member: dict) -> str:
    """Combine profile fields into a single text for embedding."""
    parts = [
        member.get("businessName", ""),
        member.get("industry", ""),
        member.get("headline", "") or "",
        member.get("bio", "") or "",
        " ".join(member.get("servicesOffered") or []),
        " ".join(member.get("keywords") or []),
    ]
    return " ".join(p for p in parts if p).strip()


def collaborative_score(user: dict, candidate: dict, interactions: dict) -> float:
    """Score based on shared interaction patterns (collaborative filtering)."""
    user_id = user["userId"]
    cand_id = candidate["userId"]

    user_connections = set()
    cand_connections = set()

    for r in interactions.get("referrals", []):
        if r["senderId"] == user_id:
            user_connections.add(r["receiverId"])
        if r["receiverId"] == user_id:
            user_connections.add(r["senderId"])
        if r["senderId"] == cand_id:
            cand_connections.add(r["receiverId"])
        if r["receiverId"] == cand_id:
            cand_connections.add(r["senderId"])

    for b in interactions.get("bookings", []):
        if b["hostId"] == user_id:
            user_connections.add(b["guestId"])
        if b["guestId"] == user_id:
            user_connections.add(b["hostId"])
        if b["hostId"] == cand_id:
            cand_connections.add(b["guestId"])
        if b["guestId"] == cand_id:
            cand_connections.add(b["hostId"])

    # Jaccard similarity of connection sets
    if not user_connections and not cand_connections:
        return 0.0
    overlap = len(user_connections & cand_connections)
    union = len(user_connections | cand_connections)
    if union == 0:
        return 0.0
    return (overlap / union) * 15


def geographic_score(user: dict, candidate: dict) -> float:
    """Score based on geographic proximity or service area compatibility."""
    # Remote/international always match
    if user.get("serviceArea") in ("remote", "international") or \
       candidate.get("serviceArea") in ("remote", "international"):
        return 8.0

    # Same state = good
    if user.get("state") and user["state"] == candidate.get("state"):
        # Same city = great
        if user.get("city") and user["city"].lower() == (candidate.get("city") or "").lower():
            return 10.0
        return 7.0

    # Same ZIP prefix
    user_zip = (user.get("zipCode") or "")[:3]
    cand_zip = (candidate.get("zipCode") or "")[:3]
    if user_zip and user_zip == cand_zip:
        return 8.0

    return 0.0


@router.post("/compute-embeddings")
async def compute_embeddings() -> dict:
    """Recompute embeddings for all member profiles. Called by daily cron."""
    from shared.db import get_members

    members = get_members()
    model = get_model()

    texts = [build_profile_text(m) for m in members]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    results = []
    for i, member in enumerate(members):
        results.append({
            "userId": member["userId"],
            "embedding": embeddings[i].tolist(),
        })

    return {"computed": len(results), "embeddings": results}
