"""Database access for the AI service — read-only queries against the same
PostgreSQL database the Express API writes to."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)
SessionLocal = sessionmaker(bind=engine)


def get_members():
    """Fetch all active member profiles with user info."""
    with SessionLocal() as session:
        rows = session.execute(text("""
            SELECT
                mp."userId",
                mp."businessName",
                mp."industry",
                mp.headline,
                mp.bio,
                mp.keywords,
                mp."servicesOffered",
                mp."icpIndustries",
                mp."icpRoles",
                mp."icpProblems",
                mp."canReferIndustries",
                mp."canReferTypes",
                mp.city,
                mp.state,
                mp."zipCode",
                mp."serviceArea",
                mp."openToBarter",
                mp."barterOfferings",
                mp."barterWants",
                u."firstName",
                u."lastName",
                u.email,
                u."subscriptionTier"
            FROM "MemberProfile" mp
            JOIN "User" u ON u.id = mp."userId"
            WHERE u."deletedAt" IS NULL
        """)).fetchall()
        return [dict(row._mapping) for row in rows]


def get_interactions():
    """Fetch referral + booking + connection data for collaborative filtering."""
    with SessionLocal() as session:
        referrals = session.execute(text("""
            SELECT "senderId", "receiverId", status, "createdAt"
            FROM "Referral"
            WHERE status IN ('SENT', 'ACCEPTED', 'CONVERTED')
        """)).fetchall()

        bookings = session.execute(text("""
            SELECT "hostId", "guestId", status, "createdAt"
            FROM "BookingCall"
            WHERE status IN ('confirmed', 'completed')
        """)).fetchall()

        connections = session.execute(text("""
            SELECT "initiatorId", "targetId", status, "strengthScore"
            FROM "BusinessConnection"
            WHERE status = 'accepted'
        """)).fetchall()

        return {
            "referrals": [dict(r._mapping) for r in referrals],
            "bookings": [dict(r._mapping) for r in bookings],
            "connections": [dict(r._mapping) for r in connections],
        }


def get_meeting_history():
    """Fetch who has met whom (for rotation)."""
    with SessionLocal() as session:
        rows = session.execute(text("""
            SELECT "userAId", "userBId", "metAt"
            FROM "MeetingHistory"
            WHERE "metAt" > NOW() - INTERVAL '30 days'
        """)).fetchall()
        return [dict(r._mapping) for r in rows]


def get_introductions():
    """Fetch introduction outcomes for AI learning."""
    with SessionLocal() as session:
        rows = session.execute(text("""
            SELECT
                "senderId", "targetId", "matchScore", status, outcome,
                "dealValue", "matchFactors", "createdAt"
            FROM "Introduction"
            WHERE status IN ('accepted', 'completed', 'declined')
        """)).fetchall()
        return [dict(r._mapping) for r in rows]
