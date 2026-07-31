import { prisma } from '../../../config/prisma.js';

/**
 * Contribution Score - a persisted, verification-gated points ledger.
 *
 * Unlike the live activity points on the leaderboard, these points are only
 * awarded once a REFERRAL RECIPIENT confirms the referral was genuinely
 * valuable, so the score reflects verified quality, not raw volume. Each award
 * is one ContributionEvent row with a deterministic id, so awards are
 * idempotent (safe to retry / reconcile). Values are the Phase 1 defaults;
 * Phase 2 makes them admin-configurable.
 */
export const CONTRIBUTION_POINTS = {
  referral_accepted: 5,
  referral_relevant: 20,
  referral_opportunity: 50,
  referral_business: 100,
} as const;

export type ContributionType = keyof typeof CONTRIBUTION_POINTS;

/** Award a verified contribution once (idempotent via the deterministic id). */
export async function awardContribution(
  dedupId: string,
  userId: string,
  type: ContributionType,
  occurredAt: Date,
): Promise<void> {
  try {
    await prisma.contributionEvent.create({
      data: { id: dedupId, userId, type, points: CONTRIBUTION_POINTS[type], occurredAt },
    });
  } catch (err) {
    // Already awarded - a repeat verification / reconcile must not double-count.
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') return;
    throw err;
  }
}

/** Verified contribution points per user, optionally since a date (monthly cycle). */
export async function verifiedPointsByUser(since?: Date): Promise<Map<string, number>> {
  const rows = await prisma.contributionEvent.groupBy({
    by: ['userId'],
    where: since ? { occurredAt: { gte: since } } : undefined,
    _sum: { points: true },
  });
  return new Map(rows.map((r) => [r.userId, r._sum.points ?? 0]));
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
    points += r.points;
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
