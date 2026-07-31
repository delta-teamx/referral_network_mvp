import { prisma } from '../../../config/prisma.js';
import {
  DEFAULT_CONTRIBUTION_POINTS,
  getContributionPoints,
} from '../../core/settings/settings.service.js';

/**
 * Contribution Score - a persisted, verification-gated points ledger.
 *
 * Unlike the live activity points on the leaderboard, these points are only
 * awarded once a REFERRAL RECIPIENT confirms the referral was genuinely
 * valuable, so the score reflects verified quality, not raw volume. Each award
 * is one ContributionEvent row with a deterministic id, so awards are
 * idempotent (safe to retry / reconcile). Point VALUES are admin-configurable
 * (settings store) with these code defaults as the fallback.
 */
export const CONTRIBUTION_POINTS = DEFAULT_CONTRIBUTION_POINTS;

export type ContributionType = keyof typeof CONTRIBUTION_POINTS;

/** Award a verified contribution once (idempotent via the deterministic id). */
export async function awardContribution(
  dedupId: string,
  userId: string,
  type: ContributionType,
  occurredAt: Date,
): Promise<void> {
  const points = (await getContributionPoints())[type] ?? CONTRIBUTION_POINTS[type];
  try {
    await prisma.contributionEvent.create({
      data: { id: dedupId, userId, type, points, occurredAt },
    });
  } catch (err) {
    // Already awarded - a repeat verification / reconcile must not double-count.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') return;
    throw err;
  }
}

/**
 * Admin manual point adjustment (award a bonus or reverse points). Recorded as
 * its own ledger row so it is auditable; `points` may be negative to reverse.
 */
export async function adjustMemberPoints(
  userId: string,
  points: number,
  reason: string,
): Promise<void> {
  const rounded = Math.round(points);
  if (!Number.isFinite(rounded) || rounded === 0) return;
  await prisma.contributionEvent.create({
    data: {
      id: `admin_adjustment:${userId}:${Date.now()}:${Math.round(Math.abs(rounded))}`,
      userId,
      type: 'admin_adjustment',
      points: rounded,
      occurredAt: new Date(),
    },
  });
  // eslint-disable-next-line no-console
  console.log(`[contribution] admin adjusted ${userId} by ${rounded}: ${reason}`);
}

/**
 * Earned contribution points (the leaderboard/reputation SCORE). Spending
 * points on rewards must never lower a member's earned score, so reward
 * redemptions are excluded here - they only affect the spendable balance.
 */
export async function verifiedPointsByUser(since?: Date): Promise<Map<string, number>> {
  const rows = await prisma.contributionEvent.groupBy({
    by: ['userId'],
    where: {
      type: { not: 'reward_redemption' },
      ...(since ? { occurredAt: { gte: since } } : {}),
    },
    _sum: { points: true },
  });
  return new Map(rows.map((r) => [r.userId, r._sum.points ?? 0]));
}

/** Spendable points balance = everything earned minus everything redeemed. */
export async function getAvailablePoints(userId: string): Promise<number> {
  const agg = await prisma.contributionEvent.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

export interface VerifiedCounts {
  relevant: number;
  opportunity: number;
  business: number;
}

/** Verified referral counts per user, split by outcome tier. */
export async function verifiedCountsByUser(since?: Date): Promise<Map<string, VerifiedCounts>> {
  const rows = await prisma.contributionEvent.groupBy({
    by: ['userId', 'type'],
    where: since ? { occurredAt: { gte: since } } : undefined,
    _count: { _all: true },
  });
  const map = new Map<string, VerifiedCounts>();
  for (const r of rows) {
    const cur = map.get(r.userId) ?? { relevant: 0, opportunity: 0, business: 0 };
    if (r.type === 'referral_relevant') cur.relevant += r._count._all;
    else if (r.type === 'referral_opportunity') cur.opportunity += r._count._all;
    else if (r.type === 'referral_business') cur.business += r._count._all;
    map.set(r.userId, cur);
  }
  return map;
}

/** One member's all-time verified contribution (for their profile). */
export async function getMemberContribution(
  userId: string,
): Promise<{ points: number } & VerifiedCounts> {
  const rows = await prisma.contributionEvent.findMany({
    where: { userId },
    select: { type: true, points: true },
  });
  let points = 0;
  const counts: VerifiedCounts = { relevant: 0, opportunity: 0, business: 0 };
  for (const r of rows) {
    // Reward spends don't reduce the earned reputation score.
    if (r.type !== 'reward_redemption') points += r.points;
    if (r.type === 'referral_relevant') counts.relevant += 1;
    else if (r.type === 'referral_opportunity') counts.opportunity += 1;
    else if (r.type === 'referral_business') counts.business += 1;
  }
  return { points, ...counts };
}

/** Contribution badges earned from verified referral quality. */
export function contributionBadges(counts: VerifiedCounts): string[] {
  const badges: string[] = [];
  const verified = counts.relevant + counts.opportunity + counts.business;
  if (verified >= 3) badges.push('Trusted Connector');
  if (counts.opportunity + counts.business >= 1) badges.push('Opportunity Creator');
  if (counts.business >= 3) badges.push('Top Referrer');
  return badges;
}
