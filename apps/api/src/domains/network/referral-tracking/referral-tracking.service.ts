import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

const REWARD_MONTHS_PER_PAID_REFERRAL = 1;

/**
 * Track a referral from a member to a non-member.
 */
export async function trackReferral(input: {
  referrerUserId: string;
  inviteeEmail: string;
  source?: string;
  eventId?: string;
}): Promise<void> {
  await prisma.referralTracking.upsert({
    where: {
      referrerUserId_inviteeEmail: {
        referrerUserId: input.referrerUserId,
        inviteeEmail: input.inviteeEmail.toLowerCase().trim(),
      },
    },
    create: {
      referrerUserId: input.referrerUserId,
      inviteeEmail: input.inviteeEmail.toLowerCase().trim(),
      source: input.source ?? 'direct',
      eventId: input.eventId ?? null,
    },
    update: {},
  });
}

/**
 * When a new user signs up, check if they were referred and link them.
 */
export async function linkReferralOnSignup(userId: string, email: string): Promise<void> {
  const tracking = await prisma.referralTracking.findFirst({
    where: { inviteeEmail: email.toLowerCase().trim(), inviteeUserId: null },
  });
  if (!tracking) return;

  await prisma.referralTracking.update({
    where: { id: tracking.id },
    data: {
      inviteeUserId: userId,
      status: 'signed_up',
      inviteeJoinedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { referredByUserId: tracking.referrerUserId },
  });

  await eventBus.publish('referral_tracking.signup', {
    referrerUserId: tracking.referrerUserId,
    inviteeUserId: userId,
  });
}

/**
 * When a referred user completes onboarding, update status.
 */
export async function markReferralOnboarded(userId: string): Promise<void> {
  await prisma.referralTracking.updateMany({
    where: { inviteeUserId: userId, status: 'signed_up' },
    data: { status: 'onboarded' },
  });
}

/**
 * When a referred user upgrades to a PAID plan, grant reward to referrer.
 * Only triggers once per referral.
 */
export async function grantReferralReward(userId: string, tier: string): Promise<void> {
  if (tier === 'FREE') return;

  const trackings = await prisma.referralTracking.findMany({
    where: {
      inviteeUserId: userId,
      rewardGranted: false,
      status: { in: ['signed_up', 'onboarded'] },
    },
  });

  for (const tracking of trackings) {
    await prisma.referralTracking.update({
      where: { id: tracking.id },
      data: {
        status: 'paid',
        inviteePaidAt: new Date(),
        inviteeTier: tier,
        rewardGranted: true,
        rewardMonths: REWARD_MONTHS_PER_PAID_REFERRAL,
      },
    });

    await prisma.user.update({
      where: { id: tracking.referrerUserId },
      data: {
        referralRewardMonths: { increment: REWARD_MONTHS_PER_PAID_REFERRAL },
      },
    });

    await eventBus.publish('referral_tracking.reward_granted', {
      referrerUserId: tracking.referrerUserId,
      inviteeUserId: userId,
      tier,
      rewardMonths: REWARD_MONTHS_PER_PAID_REFERRAL,
    });
  }
}

/**
 * Get referral stats for a member's dashboard.
 */
export async function getReferralStats(userId: string) {
  const [invited, signedUp, paid, totalRewardMonths] = await Promise.all([
    prisma.referralTracking.count({ where: { referrerUserId: userId } }),
    prisma.referralTracking.count({
      where: { referrerUserId: userId, status: { in: ['signed_up', 'onboarded', 'paid'] } },
    }),
    prisma.referralTracking.count({
      where: { referrerUserId: userId, status: 'paid' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { referralRewardMonths: true },
    }),
  ]);

  const recentReferrals = await prisma.referralTracking.findMany({
    where: { referrerUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      inviteeEmail: true,
      status: true,
      source: true,
      inviteeJoinedAt: true,
      inviteePaidAt: true,
      inviteeTier: true,
      rewardMonths: true,
      createdAt: true,
      invitee: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return {
    invited,
    signedUp,
    paid,
    earnedMonths: totalRewardMonths?.referralRewardMonths ?? 0,
    recentReferrals,
  };
}

/**
 * Admin: top referrers leaderboard.
 */
export async function getTopReferrers(limit = 20) {
  const referrers = await prisma.referralTracking.groupBy({
    by: ['referrerUserId'],
    _count: { _all: true },
    orderBy: { _count: { referrerUserId: 'desc' } },
    take: limit,
  });

  const userIds = referrers.map((r) => r.referrerUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      referralRewardMonths: true,
    },
  });

  const paidCounts = await prisma.referralTracking.groupBy({
    by: ['referrerUserId'],
    where: { referrerUserId: { in: userIds }, status: 'paid' },
    _count: { _all: true },
  });
  const paidMap = new Map(paidCounts.map((p) => [p.referrerUserId, p._count._all]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return referrers.map((r) => {
    const user = userMap.get(r.referrerUserId);
    return {
      userId: r.referrerUserId,
      name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
      email: user?.email ?? '',
      totalInvited: r._count._all,
      totalPaid: paidMap.get(r.referrerUserId) ?? 0,
      earnedMonths: user?.referralRewardMonths ?? 0,
    };
  });
}
