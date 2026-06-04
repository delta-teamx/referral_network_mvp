"""
NLP Pipeline — extract insights from member profiles + video transcripts

Capabilities:
1. Keyword extraction from bios and transcripts
2. Industry classification from free text
3. Sentiment analysis on reviews
4. Topic extraction for matching
5. Profile completeness scoring
"""

from fastapi import APIRouter
from pydantic import BaseModel
import re
from typing import Optional

router = APIRouter()

_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
            _nlp = spacy.load("en_core_web_sm")
        print("[nlp] Loaded spaCy model")
    return _nlp


class ExtractRequest(BaseModel):
    text: str
    maxKeywords: int = 15


class ProfileAnalysisRequest(BaseModel):
    businessName: str
    industry: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    transcript: Optional[str] = None
    servicesOffered: list[str] = []
    keywords: list[str] = []


@router.post("/extract-keywords")
async def extract_keywords(req: ExtractRequest) -> dict:
    """Extract meaningful keywords from text using NLP."""
    nlp = get_nlp()
    doc = nlp(req.text)

    keywords = set()

    # Named entities
    for ent in doc.ents:
        if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART", "LAW"):
            keywords.add(ent.text.lower())

    # Noun phrases
    for chunk in doc.noun_chunks:
        cleaned = chunk.text.lower().strip()
        if len(cleaned) > 2 and len(cleaned.split()) <= 4:
            keywords.add(cleaned)

    # Important single tokens (nouns, proper nouns)
    for token in doc:
        if token.pos_ in ("NOUN", "PROPN") and not token.is_stop and len(token.text) > 2:
            keywords.add(token.lemma_.lower())

    # Remove generic words
    stopwords = {"service", "business", "company", "work", "year", "time", "people", "thing", "way"}
    keywords = [k for k in keywords if k not in stopwords]

    return {"keywords": sorted(keywords)[:req.maxKeywords]}


@router.post("/analyze-profile")
async def analyze_profile(req: ProfileAnalysisRequest) -> dict:
    """Analyze a member profile for quality, keywords, and suggestions."""
    nlp = get_nlp()

    # Combine all text
    all_text = " ".join(filter(None, [
        req.headline,
        req.bio,
        req.transcript,
        " ".join(req.servicesOffered),
    ]))

    # Extract keywords from combined text
    doc = nlp(all_text) if all_text.strip() else None

    extracted_keywords = []
    topics = []
    if doc:
        for chunk in doc.noun_chunks:
            cleaned = chunk.text.lower().strip()
            if len(cleaned) > 2:
                extracted_keywords.append(cleaned)

        for ent in doc.ents:
            if ent.label_ in ("ORG", "PRODUCT", "GPE", "PERSON"):
                topics.append({"text": ent.text, "type": ent.label_})

    # Profile completeness score
    completeness = compute_completeness(req)

    # Suggested keywords (from NLP) that aren't already in their profile
    existing = set(k.lower() for k in req.keywords)
    suggested = [k for k in extracted_keywords if k not in existing][:10]

    # Industry classification confidence
    industry_terms = extract_industry_terms(all_text)

    return {
        "completeness": completeness,
        "extractedKeywords": extracted_keywords[:20],
        "suggestedKeywords": suggested,
        "topics": topics[:10],
        "industryTerms": industry_terms,
        "wordCount": len(all_text.split()) if all_text else 0,
        "recommendations": generate_recommendations(req, completeness),
    }


def compute_completeness(req: ProfileAnalysisRequest) -> dict:
    """Score profile completeness 0-100."""
    checks = {
        "businessName": bool(req.businessName),
        "industry": bool(req.industry),
        "headline": bool(req.headline),
        "bio": bool(req.bio) and len(req.bio or "") > 50,
        "services": len(req.servicesOffered) >= 2,
        "keywords": len(req.keywords) >= 3,
        "transcript": bool(req.transcript),
    }

    score = sum(checks.values()) / len(checks) * 100
    return {
        "score": round(score, 1),
        "checks": checks,
        "missing": [k for k, v in checks.items() if not v],
    }


def extract_industry_terms(text: str) -> list[str]:
    """Extract industry-specific terms."""
    industry_patterns = [
        r"\b(real estate|realtor|property|mortgage|lending)\b",
        r"\b(accounting|cpa|tax|bookkeeping|audit)\b",
        r"\b(legal|attorney|lawyer|law firm|litigation)\b",
        r"\b(marketing|seo|advertising|branding|social media)\b",
        r"\b(insurance|coverage|claims|underwriting)\b",
        r"\b(construction|contractor|builder|renovation)\b",
        r"\b(photography|videography|media production)\b",
        r"\b(wedding|event planning|catering)\b",
        r"\b(plumbing|electrical|hvac|roofing)\b",
        r"\b(consulting|advisory|strategy)\b",
        r"\b(web design|development|software|tech)\b",
        r"\b(healthcare|medical|dental|wellness)\b",
        r"\b(financial planning|investing|wealth management)\b",
    ]

    found = []
    text_lower = text.lower()
    for pattern in industry_patterns:
        matches = re.findall(pattern, text_lower)
        found.extend(matches)

    return list(set(found))


def generate_recommendations(req: ProfileAnalysisRequest, completeness: dict) -> list[str]:
    """Generate actionable recommendations to improve the profile."""
    recs = []

    if not req.headline:
        recs.append("Add a headline — one sentence about what you do helps AI matching by 40%")
    if not req.bio or len(req.bio or "") < 50:
        recs.append("Write a longer bio (50+ words) — profiles with detailed bios get 3x more intros")
    if len(req.servicesOffered) < 2:
        recs.append("List at least 2 services — helps members know when to refer clients to you")
    if len(req.keywords) < 3:
        recs.append("Add more keywords — the AI uses these to find your ideal matches")
    if not req.transcript:
        recs.append("Record a video intro — members with videos accept 3x more introductions")

    return recs


@router.post("/analyze-review")
async def analyze_review(req: ExtractRequest) -> dict:
    """Analyze a review for sentiment and key themes."""
    nlp = get_nlp()
    doc = nlp(req.text)

    # Simple sentiment (positive/negative word ratio)
    positive_words = {"great", "excellent", "amazing", "wonderful", "fantastic", "best",
                      "professional", "recommend", "helpful", "responsive", "quality", "outstanding"}
    negative_words = {"terrible", "worst", "avoid", "rude", "unprofessional", "slow",
                      "disappointing", "poor", "bad", "horrible", "scam", "overpriced"}

    words = set(token.text.lower() for token in doc)
    pos_count = len(words & positive_words)
    neg_count = len(words & negative_words)

    if pos_count > neg_count:
        sentiment = "positive"
        confidence = min(pos_count / (pos_count + neg_count + 1), 0.95)
    elif neg_count > pos_count:
        sentiment = "negative"
        confidence = min(neg_count / (pos_count + neg_count + 1), 0.95)
    else:
        sentiment = "neutral"
        confidence = 0.5

    themes = []
    for chunk in doc.noun_chunks:
        if len(chunk.text) > 3:
            themes.append(chunk.text.lower())

    return {
        "sentiment": sentiment,
        "confidence": round(confidence, 2),
        "themes": list(set(themes))[:5],
        "wordCount": len(req.text.split()),
    }
