import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma.js';
import { generateMatchesForUser } from './ai-matching.service.js';

/**
 * Feature 2 — Automated Referral Assignment for new members.
 *
 * The brief: "Auto-assign 10 referrals/month for the first 3 months (30 total)
 * to every new member upon signup." In NRG-speak these "referrals" are the
 * same artifact as a tier-1 match suggestion — an Introduction row the
 * member sees on their dashboard, with the score, reason, and signals — so
 * we reuse the Introduction table rather than introducing a parallel one.
 *
 * Each auto-assigned row carries matchFactors.onboarding = { month, batch:
 * "auto" | "admin", assignedAt }, which makes them queryable for the admin
 * panel and analytics, distinguishes auto-assigned from organic suggestions,
 * and gives the scheduler an idempotency key for top-ups.
 */

export interface OnboardingAssignmentResult {
  assigned: number;
  skipped: number;
  totalActiveForMonth: number;
}

export const ONBOARDING_TARGET_PER_MONTH = 10;
export const ONBOARDING_MONTH_COUNT = 3;

export async function assignOnboardingReferrals(
  userId: string,
  opts: { month: number; count?: number; batch?: 'auto' | 'admin' } = { month: 1 },
): Promise<OnboardingAssignmentResult> {
  const target = opts.count ?? ONBOARDING_TARGET_PER_MONTH;
  const batch = opts.batch ?? 'auto';
  if (opts.month < 1 || opts.month > ONBOARDING_MONTH_COUNT) {
    throw new Error(`Onboarding month must be 1..${ONBOARDING_MONTH_COUNT}, got ${opts.month}`);
  }

  const existing = await prisma.introduction.findMany({
    where: {
      senderId: userId,
      status: { in: ['suggested', 'requested', 'accepted', 'completed'] },
    },
    select: { targetId: true, matchFactors: true, status: true },
  });

  const alreadyTargeted = new Set(existing.map((e) => e.targetId));
  const currentMonthAssignments = existing.filter((e) => {
    const factors = e.matchFactors as Record<string, unknown> | null;
    const onboarding = factors?.onboarding as Record<string, unknown> | undefined;
    return onboarding?.month === opts.month;
  }).length;

  const remaining = Math.max(0, target - currentMonthAssignments);
  if (remaining === 0) {
    return { assigned: 0, skipped: 0, totalActiveForMonth: currentMonthAssignments };
  }

  const matches = await generateMatchesForUser(userId, { limit: 120 });
  const candidates = matches.filter((m) => !alreadyTargeted.has(m.targetUserId));
  const slice = candidates.slice(0, remaining);

  if (slice.length === 0) {
    return { assigned: 0, skipped: 0, totalActiveForMonth: currentMonthAssignments };
  }

  const assignedAt = new Date().toISOString();
  let assigned = 0;
  let skipped = 0;

  for (const match of slice) {
    const data: Prisma.IntroductionUncheckedCreateInput = {
      senderId: userId,
      targetId: match.targetUserId,
      reason: match.reason,
      matchScore: match.score,
      matchFactors: {
        heuristic: match.factors,
        onboarding: { month: opts.month, batch, assignedAt },
      } as Prisma.InputJsonValue,
      status: 'suggested',
    };
    try {
      await prisma.introduction.create({ data });
      assigned++;
    } catch {
      skipped++;
    }
  }

  return {
    assigned,
    skipped,
    totalActiveForMonth: currentMonthAssignments + assigned,
  };
}

/**
 * Calendar month index (1, 2, or 3) for a member relative to their signup.
 * Returns null if the member is past their first 3 months — auto-assignment
 * is no longer in effect.
 */
export function onboardingMonthFor(signupAt: Date, now: Date = new Date()): number | null {
  const months =
    (now.getUTCFullYear() - signupAt.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - signupAt.getUTCMonth());
  const month = months + 1;
  if (month < 1) return null;
  if (month > ONBOARDING_MONTH_COUNT) return null;
  return month;
}

/**
 * Walks every member whose account is within their first 3 months and tops
 * them up to the per-month target. Idempotent — only fills the gap.
 */
export async function topUpOnboardingReferralsForAllMembers(opts: { now?: Date } = {}): Promise<{
  membersTouched: number;
  assigned: number;
}> {
  const now = opts.now ?? new Date();
  const earliestSignup = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (ONBOARDING_MONTH_COUNT - 1), 1),
  );

  const members = await prisma.user.findMany({
    where: { deletedAt: null, createdAt: { gte: earliestSignup }, memberProfile: { isNot: null } },
    select: { id: true, createdAt: true },
  });

  let membersTouched = 0;
  let assigned = 0;
  for (const m of members) {
    const month = onboardingMonthFor(m.createdAt, now);
    if (!month) continue;
    const result = await assignOnboardingReferrals(m.id, { month });
    if (result.assigned > 0) {
      membersTouched++;
      assigned += result.assigned;
    }
  }
  return { membersTouched, assigned };
}
