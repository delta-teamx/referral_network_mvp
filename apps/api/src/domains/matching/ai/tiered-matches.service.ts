import { prisma } from '../../../config/prisma.js';
import { generateMatchesForUser } from './ai-matching.service.js';
import { classifyTier, normalizeScore, type MatchTier } from './tiers.js';

export interface LlmSignals {
  industryFit: number;
  referralPotential: number;
  geographicFit: number;
  networkValue: number;
}

export interface EnrichedTieredMatch {
  targetUserId: string;
  rawScore: number;
  normalizedScore: number;
  tier: MatchTier;
  reason: string;
  factors: Record<string, number>;
  enrichedBy: 'rules' | 'llm';
  llmSignals: LlmSignals | null;
  target: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    businessName: string;
    industry: string;
    headline: string | null;
    videoUrl: string | null;
    city: string | null;
    state: string | null;
  };
}

export interface TieredMatchBuckets {
  level1: EnrichedTieredMatch[];
  level2: EnrichedTieredMatch[];
  level3: EnrichedTieredMatch[];
}

export async function generateTieredMatchesForUser(
  userId: string,
  opts?: { groupId?: string; limit?: number },
): Promise<TieredMatchBuckets> {
  const limit = opts?.limit ?? 60;
  const matches = await generateMatchesForUser(userId, { groupId: opts?.groupId, limit });
  if (matches.length === 0) {
    return { level1: [], level2: [], level3: [] };
  }

  const targetIds = matches.map((m) => m.targetUserId);
  const [targets, persistedIntros] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        memberProfile: {
          select: {
            businessName: true,
            industry: true,
            headline: true,
            videoUrl: true,
            city: true,
            state: true,
          },
        },
      },
    }),
    prisma.introduction.findMany({
      where: {
        senderId: userId,
        targetId: { in: targetIds },
        status: { in: ['suggested', 'requested', 'accepted'] },
      },
      select: { targetId: true, matchScore: true, reason: true, matchFactors: true },
    }),
  ]);

  const targetMap = new Map(targets.map((t) => [t.id, t]));
  const introMap = new Map(persistedIntros.map((i) => [i.targetId, i]));
  const buckets: TieredMatchBuckets = { level1: [], level2: [], level3: [] };

  for (const match of matches) {
    const target = targetMap.get(match.targetUserId);
    if (!target?.memberProfile) continue;

    const intro = introMap.get(match.targetUserId);
    const llmSignals = readLlmSignals(intro?.matchFactors);

    const baseScore = match.score;
    const baseReason = match.reason;
    const baseFactors = match.factors;

    const rawScore = llmSignals && intro ? Number(intro.matchScore) : baseScore;
    const normalizedScore = llmSignals && intro ? clamp(rawScore, 0, 100) : normalizeScore(baseScore);
    const reason = llmSignals && intro?.reason ? intro.reason : baseReason;
    const tier = classifyTier(normalizedScore);

    buckets[tier].push({
      targetUserId: match.targetUserId,
      rawScore,
      normalizedScore,
      tier,
      reason,
      factors: baseFactors,
      enrichedBy: llmSignals ? 'llm' : 'rules',
      llmSignals,
      target: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
        avatarUrl: target.avatarUrl,
        businessName: target.memberProfile.businessName,
        industry: target.memberProfile.industry,
        headline: target.memberProfile.headline,
        videoUrl: target.memberProfile.videoUrl,
        city: target.memberProfile.city,
        state: target.memberProfile.state,
      },
    });
  }

  for (const tier of ['level1', 'level2', 'level3'] as const) {
    buckets[tier].sort((a, b) => b.normalizedScore - a.normalizedScore);
  }

  return buckets;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.round(Math.max(lo, Math.min(hi, n)));
}

function readLlmSignals(matchFactors: unknown): LlmSignals | null {
  if (!matchFactors || typeof matchFactors !== 'object') return null;
  const llm = (matchFactors as Record<string, unknown>).llm;
  if (!llm || typeof llm !== 'object') return null;
  const obj = llm as Record<string, unknown>;
  const keys: (keyof LlmSignals)[] = [
    'industryFit',
    'referralPotential',
    'geographicFit',
    'networkValue',
  ];
  const result: Partial<LlmSignals> = {};
  for (const k of keys) {
    const v = obj[k];
    if (typeof v !== 'number') return null;
    result[k] = v;
  }
  return result as LlmSignals;
}
