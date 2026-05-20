import { prisma } from '../../../config/prisma.js';
import { ONBOARDING_MONTH_COUNT, ONBOARDING_TARGET_PER_MONTH, onboardingMonthFor } from './onboarding-referrals.service.js';

/**
 * Admin view of members in their onboarding window — drives the override
 * panel. For each member in their first 3 months, return their per-month
 * assignment counts so the admin can spot under-served members at a glance.
 */

export interface OnboardingMemberRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  signedUpAt: string;
  currentMonth: number;
  countsByMonth: Record<number, number>;
  totalAssigned: number;
}

export async function listOnboardingMembers(opts: { now?: Date } = {}): Promise<OnboardingMemberRow[]> {
  const now = opts.now ?? new Date();
  const earliestSignup = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (ONBOARDING_MONTH_COUNT - 1), 1),
  );

  const members = await prisma.user.findMany({
    where: { deletedAt: null, createdAt: { gte: earliestSignup }, memberProfile: { isNot: null } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
    },
  });

  if (members.length === 0) return [];

  const intros = await prisma.introduction.findMany({
    where: {
      senderId: { in: members.map((m) => m.id) },
      status: { in: ['suggested', 'requested', 'accepted', 'completed'] },
    },
    select: { senderId: true, matchFactors: true },
  });

  const countsByUser = new Map<string, Record<number, number>>();
  for (const intro of intros) {
    const factors = intro.matchFactors as Record<string, unknown> | null;
    const onboarding = factors?.onboarding as Record<string, unknown> | undefined;
    if (!onboarding || typeof onboarding.month !== 'number') continue;
    if (!countsByUser.has(intro.senderId)) countsByUser.set(intro.senderId, {});
    const counts = countsByUser.get(intro.senderId)!;
    counts[onboarding.month] = (counts[onboarding.month] ?? 0) + 1;
  }

  return members
    .map((m) => {
      const currentMonth = onboardingMonthFor(m.createdAt, now);
      if (!currentMonth) return null;
      const countsByMonth = countsByUser.get(m.id) ?? {};
      const totalAssigned = Object.values(countsByMonth).reduce((a, b) => a + b, 0);
      return {
        userId: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        signedUpAt: m.createdAt.toISOString(),
        currentMonth,
        countsByMonth,
        totalAssigned,
      } satisfies OnboardingMemberRow;
    })
    .filter((row): row is OnboardingMemberRow => row !== null);
}

export const ONBOARDING_TARGET = ONBOARDING_TARGET_PER_MONTH;
export const ONBOARDING_MONTHS = ONBOARDING_MONTH_COUNT;
