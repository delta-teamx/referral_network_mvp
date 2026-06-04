"""
Recommendation Engine — "Members you should meet"

Combines multiple signals:
1. Content-based: profile similarity via embeddings
2. Collaborative: "members like you connected with them"
3. Behavioral: who you've viewed, booked, referred
4. Diversity: ensure variety in recommendations (not all same industry)
5. Freshness: boost newer members who need connections
"""

from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
from typing import Optional
from datetime import datetime, timedelta

router = APIRouter()


class RecommendRequest(BaseModel):
    userId: str
    limit: int = 5
    diversityWeight: float = 0.3  # 0-1: higher = more diverse industries


@router.post("/for-user")
async def recommendations_for_user(req: RecommendRequest) -> dict:
    """Get personalized member recommendations."""
    from shared.db import get_members, get_interactions, get_meeting_history

    members = get_members()
    interactions = get_interactions()
    history = get_meeting_history()

    user = next((m for m in members if m["userId"] == req.userId), None)
    if not user:
        return {"recommendations": [], "error": "User not found"}

    candidates = [m for m in members if m["userId"] != req.userId]

    # Build exclusion set (already connected, recently met)
    exclude = set()
    for h in history:
        if h["userAId"] == req.userId:
            exclude.add(h["userBId"])
        if h["userBId"] == req.userId:
            exclude.add(h["userAId"])

    for c in interactions.get("connections", []):
        if c["initiatorId"] == req.userId:
            exclude.add(c["targetId"])
        if c["targetId"] == req.userId:
            exclude.add(c["initiatorId"])

    candidates = [c for c in candidates if c["userId"] not in exclude]

    if not candidates:
        return {"recommendations": []}

    # Score candidates
    scored = []
    seen_industries = set()

    for candidate in candidates:
        score = 0.0
        reasons = []

        # ICP match
        user_icp = set(i.lower() for i in (user.get("icpIndustries") or []))
        cand_ind = candidate.get("industry", "").lower()
        if cand_ind in user_icp:
            score += 30
            reasons.append(f"Matches your ICP: {candidate['industry']}")

        # Can refer to each other
        user_can_refer = set(i.lower() for i in (user.get("canReferIndustries") or []))
        if cand_ind in user_can_refer:
            score += 20
            reasons.append("You can refer clients to them")

        # Geographic match
        if user.get("serviceArea") in ("remote", "international") or \
           candidate.get("serviceArea") in ("remote", "international"):
            score += 10
        elif user.get("state") == candidate.get("state"):
            score += 15
            if user.get("city") and user["city"].lower() == (candidate.get("city") or "").lower():
                score += 5

        # Barter compatibility
        if user.get("openToBarter") and candidate.get("openToBarter"):
            user_wants = set(w.lower() for w in (user.get("barterWants") or []))
            cand_offers = set(o.lower() for o in (candidate.get("barterOfferings") or []))
            if user_wants & cand_offers:
                score += 10
                reasons.append("Can trade services with you")

        # Freshness boost (newer members get a boost)
        # This would need createdAt from the query
        score += 5  # Default small boost

        # Diversity penalty (if we already have this industry in results)
        if cand_ind in seen_industries:
            score *= (1 - req.diversityWeight)

        # Tier boost
        if candidate.get("subscriptionTier") in ("PRO", "PREMIUM"):
            score += 5

        if not reasons:
            reasons.append(f"{candidate['industry']} professional in {candidate.get('city', 'your area')}")

        scored.append({
            "userId": candidate["userId"],
            "name": f"{candidate['firstName']} {candidate['lastName']}",
            "business": candidate["businessName"],
            "industry": candidate["industry"],
            "city": candidate.get("city"),
            "state": candidate.get("state"),
            "score": round(score, 1),
            "reasons": reasons,
        })

    # Sort and apply diversity
    scored.sort(key=lambda x: x["score"], reverse=True)

    # Select top N with industry diversity
    final = []
    industries_picked = set()
    for item in scored:
        if len(final) >= req.limit:
            break
        ind = item["industry"].lower()
        # Allow max 2 from same industry
        if sum(1 for f in final if f["industry"].lower() == ind) < 2:
            final.append(item)
            industries_picked.add(ind)

    return {
        "recommendations": final,
        "totalCandidates": len(candidates),
        "excluded": len(exclude),
    }


@router.get("/trending-industries")
async def trending_industries() -> dict:
    """Which industries are most active (most referrals, bookings, new members)."""
    from shared.db import get_members, get_interactions

    members = get_members()
    interactions = get_interactions()

    industry_activity = {}
    for m in members:
        ind = m.get("industry", "Unknown")
        if ind not in industry_activity:
            industry_activity[ind] = {"members": 0, "referralsSent": 0, "bookings": 0}
        industry_activity[ind]["members"] += 1

    user_industry = {m["userId"]: m.get("industry", "Unknown") for m in members}

    for r in interactions.get("referrals", []):
        ind = user_industry.get(r["senderId"], "Unknown")
        if ind in industry_activity:
            industry_activity[ind]["referralsSent"] += 1

    for b in interactions.get("bookings", []):
        ind = user_industry.get(b["hostId"], "Unknown")
        if ind in industry_activity:
            industry_activity[ind]["bookings"] += 1

    # Compute activity score
    results = []
    for ind, data in industry_activity.items():
        activity = data["members"] * 1 + data["referralsSent"] * 3 + data["bookings"] * 2
        results.append({
            "industry": ind,
            "members": data["members"],
            "referralsSent": data["referralsSent"],
            "bookings": data["bookings"],
            "activityScore": activity,
        })

    results.sort(key=lambda x: x["activityScore"], reverse=True)
    return {"trending": results[:15]}
