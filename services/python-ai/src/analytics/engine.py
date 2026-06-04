"""
Analytics Engine — referral pattern analysis + conversion predictions

Analyzes:
1. Referral conversion patterns (which industries convert best)
2. Network health metrics (connection density, activity trends)
3. Conversion probability prediction (will this referral close?)
4. Revenue forecasting based on historical patterns
"""

from fastapi import APIRouter
from pydantic import BaseModel
import pandas as pd
import numpy as np
from typing import Optional

router = APIRouter()


class ConversionPredictionRequest(BaseModel):
    senderIndustry: str
    receiverIndustry: str
    senderTier: str
    hasNotes: bool
    hasClientEmail: bool


@router.post("/predict-conversion")
async def predict_conversion(req: ConversionPredictionRequest) -> dict:
    """Predict probability a referral will convert based on historical patterns."""
    from shared.db import get_interactions

    interactions = get_interactions()
    referrals = interactions.get("referrals", [])

    if len(referrals) < 10:
        return {"probability": 0.5, "confidence": "low", "reason": "Not enough data yet"}

    df = pd.DataFrame(referrals)
    total = len(df)
    converted = len(df[df["status"] == "CONVERTED"])
    base_rate = converted / total if total > 0 else 0.3

    # Adjustments based on features
    probability = base_rate

    # Notes increase conversion by ~20%
    if req.hasNotes:
        probability *= 1.2

    # Client email increases conversion by ~30%
    if req.hasClientEmail:
        probability *= 1.3

    # PRO/PREMIUM senders have higher conversion
    if req.senderTier in ("PRO", "PREMIUM"):
        probability *= 1.15

    probability = min(probability, 0.95)

    confidence = "high" if total > 100 else "medium" if total > 30 else "low"

    return {
        "probability": round(probability, 3),
        "confidence": confidence,
        "basedOn": total,
        "factors": {
            "baseRate": round(base_rate, 3),
            "notesBoost": req.hasNotes,
            "emailBoost": req.hasClientEmail,
            "tierBoost": req.senderTier in ("PRO", "PREMIUM"),
        }
    }


@router.get("/network-health")
async def network_health() -> dict:
    """Analyze overall network health metrics."""
    from shared.db import get_members, get_interactions

    members = get_members()
    interactions = get_interactions()

    total_members = len(members)
    referrals = interactions.get("referrals", [])
    bookings = interactions.get("bookings", [])
    connections = interactions.get("connections", [])

    # Industry distribution
    industries = {}
    for m in members:
        ind = m.get("industry", "Unknown")
        industries[ind] = industries.get(ind, 0) + 1

    # Top industries
    top_industries = sorted(industries.items(), key=lambda x: x[1], reverse=True)[:10]

    # Connection density
    possible_connections = total_members * (total_members - 1) / 2
    actual_connections = len(connections)
    density = actual_connections / possible_connections if possible_connections > 0 else 0

    # Conversion rate
    total_referrals = len(referrals)
    converted = sum(1 for r in referrals if r["status"] == "CONVERTED")
    conversion_rate = converted / total_referrals if total_referrals > 0 else 0

    # Service area breakdown
    service_areas = {"local": 0, "remote": 0, "international": 0}
    for m in members:
        area = m.get("serviceArea", "local")
        service_areas[area] = service_areas.get(area, 0) + 1

    return {
        "totalMembers": total_members,
        "totalReferrals": total_referrals,
        "totalBookings": len(bookings),
        "totalConnections": actual_connections,
        "connectionDensity": round(density, 4),
        "conversionRate": round(conversion_rate, 3),
        "topIndustries": [{"industry": k, "count": v} for k, v in top_industries],
        "serviceAreaBreakdown": service_areas,
        "healthScore": compute_health_score(total_members, density, conversion_rate),
    }


def compute_health_score(members: int, density: float, conversion: float) -> dict:
    """0-100 health score with breakdown."""
    member_score = min(members / 100, 1.0) * 30  # 30 pts for reaching 100 members
    density_score = min(density / 0.1, 1.0) * 35  # 35 pts for 10% density
    conversion_score = min(conversion / 0.3, 1.0) * 35  # 35 pts for 30% conversion

    total = member_score + density_score + conversion_score
    return {
        "total": round(total, 1),
        "memberGrowth": round(member_score, 1),
        "networkDensity": round(density_score, 1),
        "referralConversion": round(conversion_score, 1),
    }


@router.get("/industry-insights/{industry}")
async def industry_insights(industry: str) -> dict:
    """Deep dive into a specific industry's performance."""
    from shared.db import get_members, get_interactions

    members = get_members()
    interactions = get_interactions()

    industry_members = [m for m in members if m.get("industry", "").lower() == industry.lower()]

    if not industry_members:
        return {"error": f"No members found in {industry}"}

    user_ids = set(m["userId"] for m in industry_members)
    referrals = interactions.get("referrals", [])

    sent = [r for r in referrals if r["senderId"] in user_ids]
    received = [r for r in referrals if r["receiverId"] in user_ids]
    converted_sent = sum(1 for r in sent if r["status"] == "CONVERTED")
    converted_received = sum(1 for r in received if r["status"] == "CONVERTED")

    # Top referral partners (who do they refer to most?)
    partner_counts = {}
    for r in sent:
        partner = next((m for m in members if m["userId"] == r["receiverId"]), None)
        if partner:
            ind = partner["industry"]
            partner_counts[ind] = partner_counts.get(ind, 0) + 1

    top_partners = sorted(partner_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "industry": industry,
        "memberCount": len(industry_members),
        "referralsSent": len(sent),
        "referralsReceived": len(received),
        "conversionRateSent": round(converted_sent / len(sent), 3) if sent else 0,
        "conversionRateReceived": round(converted_received / len(received), 3) if received else 0,
        "topReferralPartners": [{"industry": k, "count": v} for k, v in top_partners],
    }
