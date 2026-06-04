import { env } from '../../config/env.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET ?? '';

async function callAI<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Secret': AI_SERVICE_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getSmartMatches(userId: string, limit = 10) {
  return callAI<{ matches: Array<{
    targetUserId: string;
    targetName: string;
    targetBusiness: string;
    targetIndustry: string;
    score: number;
    reasons: string[];
    breakdown: Record<string, number>;
  }> }>('/matching/smart-match', { userId, limit });
}

export async function predictConversion(input: {
  senderIndustry: string;
  receiverIndustry: string;
  senderTier: string;
  hasNotes: boolean;
  hasClientEmail: boolean;
}) {
  return callAI<{ probability: number; confidence: string }>('/analytics/predict-conversion', input);
}

export async function getNetworkHealth() {
  return callAI<{
    totalMembers: number;
    conversionRate: number;
    healthScore: { total: number };
  }>('/analytics/network-health');
}

export async function analyzeProfile(input: {
  businessName: string;
  industry: string;
  headline?: string;
  bio?: string;
  transcript?: string;
  servicesOffered: string[];
  keywords: string[];
}) {
  return callAI<{
    completeness: { score: number; missing: string[] };
    suggestedKeywords: string[];
    recommendations: string[];
  }>('/nlp/analyze-profile', input);
}

export async function getRecommendations(userId: string, limit = 5) {
  return callAI<{ recommendations: Array<{
    userId: string;
    name: string;
    business: string;
    industry: string;
    score: number;
    reasons: string[];
  }> }>('/recommendations/for-user', { userId, limit });
}

export async function extractKeywords(text: string) {
  return callAI<{ keywords: string[] }>('/nlp/extract-keywords', { text, maxKeywords: 15 });
}

export async function getTrendingIndustries() {
  return callAI<{ trending: Array<{ industry: string; activityScore: number }> }>('/recommendations/trending-industries');
}
