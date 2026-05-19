import { prisma } from '../../../config/prisma.js';
import { generateMatchesForUser } from './ai-matching.service.js';
import { classifyTier, normalizeScore, type MatchTier } from './tiers.js';

export interface EnrichedTieredMatch {
  targetUserId: string;
  rawScore: number;
  normalizedScore: number;
  tier: MatchTier;
  reason: string;
  factors: Record<string, number>;
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
  const targets = await prisma.user.findMany({
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
  });

  const targetMap = new Map(targets.map((t) => [t.id, t]));
  const buckets: TieredMatchBuckets = { level1: [], level2: [], level3: [] };

  for (const match of matches) {
    const target = targetMap.get(match.targetUserId);
    if (!target?.memberProfile) continue;

    const normalizedScore = normalizeScore(match.score);
    const tier = classifyTier(normalizedScore);

    buckets[tier].push({
      targetUserId: match.targetUserId,
      rawScore: match.score,
      normalizedScore,
      tier,
      reason: match.reason,
      factors: match.factors,
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

  return buckets;
}
