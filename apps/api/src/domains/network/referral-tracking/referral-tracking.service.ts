import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { env } from '../../../config/env.js';
import { eventBus } from '../../core/events/index.js';
import { createNotification } from '../../core/notifications/notifications.service.js';

const REWARD_MONTHS_PER_PAID_REFERRAL = 1;

// Invite-and-earn program. Points reward the behaviors that make the network
// valuable; an invite only counts once the invitee completes onboarding (the
// fraud guard: a signed-up-but-empty account earns nothing).
export const LEADERBOARD_POINTS = {
  inviteOnboarded: 50,
  dealWon: 30,
  contractSigned: 20,
  referralSent: 10,
  callHeld: 5,
} as const;

/** The first N members are founding members (lifetime Premium promo). */
const FOUNDING_MEMBER_LIMIT = 200;

/** Post-200 reward ladder: 1 free Premium month per 2 successful invites... */
const INVITES_PER_FREE_MONTH = 2;
/** ...a bonus month at 10 invites... */
const AMBASSADOR_INVITES = 10;
/** ...and lifetime Premium at 25. */
const LIFETIME_PREMIUM_INVITES = 25;

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
 * A signup that arrived through someone's personal invite link (?ref=userId).
 * Attributes it even when the referrer never pre-tracked the email.
 */
export async function attributeSignupToReferrer(
  inviteeUserId: string,
  inviteeEmail: string,
  refUserId: string,
): Promise<void> {
  if (!refUserId || refUserId === inviteeUserId) return;
  const referrer = await prisma.user.findFirst({
    where: { id: refUserId, deletedAt: null },
    select: { id: true },
  });
  if (!referrer) return;

  const email = inviteeEmail.toLowerCase().trim();
  const existing = await prisma.referralTracking.findUnique({
    where: { referrerUserId_inviteeEmail: { referrerUserId: refUserId, inviteeEmail: email } },
  });
  if (!existing) {
    await prisma.referralTracking.create({
      data: {
        referrerUserId: refUserId,
        inviteeEmail: email,
        source: 'link',
        status: 'signed_up',
        inviteeUserId,
        inviteeJoinedAt: new Date(),
      },
    });
  } else if (!existing.inviteeUserId) {
    await prisma.referralTracking.update({
      where: { id: existing.id },
      data: { inviteeUserId, status: 'signed_up', inviteeJoinedAt: new Date() },
    });
  }

  await prisma.user.update({
    where: { id: inviteeUserId },
    data: { referredByUserId: refUserId },
  });

  await eventBus.publish('referral_tracking.signup', {
    referrerUserId: refUserId,
    inviteeUserId,
  });
}

/**
 * When a referred user completes onboarding, the invite starts counting:
 * status flips to onboarded, the referrer gets an in-app notification, and
 * the reward ladder is applied.
 */
export async function markReferralOnboarded(userId: string): Promise<void> {
  const trackings = await prisma.referralTracking.findMany({
    where: { inviteeUserId: userId, status: 'signed_up' },
    include: { invitee: { select: { firstName: true, lastName: true } } },
  });
  if (trackings.length === 0) return;

  await prisma.referralTracking.updateMany({
    where: { id: { in: trackings.map((t) => t.id) } },
    data: { status: 'onboarded' },
  });

  for (const t of trackings) {
    const inviteeName = t.invitee ? `${t.invitee.firstName} ${t.invitee.lastName}` : 'Your invite';
    await applyInviteRewards(t.referrerUserId, inviteeName);
  }
}

/**
 * Reward ladder, applied each time one of a member's invites completes
 * onboarding. Founding members already hold lifetime Premium, so their track
 * is status badges (computed from counts in the leaderboard). Members after
 * the founding 200 earn: 1 free Premium month per 2 successful invites, a
 * bonus month at 10, lifetime Premium at 25.
 */
async function applyInviteRewards(referrerUserId: string, inviteeName: string): Promise<void> {
  try {
    const count = await prisma.referralTracking.count({
      where: { referrerUserId, status: { in: ['onboarded', 'paid'] } },
    });

    const founding = await isFoundingMember(referrerUserId);
    if (!founding) {
      let bonusMonths = 0;
      if (count % INVITES_PER_FREE_MONTH === 0) bonusMonths += 1;
      if (count === AMBASSADOR_INVITES) bonusMonths += 1;
      if (bonusMonths > 0) {
        await prisma.user.update({
          where: { id: referrerUserId },
          data: { referralRewardMonths: { increment: bonusMonths } },
        });
      }
      if (count >= LIFETIME_PREMIUM_INVITES) {
        await prisma.user.update({
          where: { id: referrerUserId },
          data: { subscriptionTier: 'PREMIUM' },
        });
      }
    }

    await createNotification({
      userId: referrerUserId,
      type: 'referral',
      title: 'Your invite joined Referral Nova',
      body: `${inviteeName} completed onboarding through your invite link. That's ${count} successful ${
        count === 1 ? 'invite' : 'invites'
      } (+${LEADERBOARD_POINTS.inviteOnboarded} leaderboard points).`,
      data: { kind: 'invite_onboarded', count },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[referral-tracking] applyInviteRewards failed:', err);
  }
}

/** Founding member = among the first 200 (non-admin) accounts ever created. */
async function isFoundingMember(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return false;
  const earlier = await prisma.user.count({
    where: { deletedAt: null, role: { not: 'ADMIN' }, createdAt: { lt: user.createdAt } },
  });
  return earlier < FOUNDING_MEMBER_LIMIT;
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
 * Member-facing community leaderboard: every active member ranked by activity
 * points (successful invites, deals won, contracts signed, referrals sent,
 * calls held), plus the viewer's own stats, badges and invite link.
 */
export async function getCommunityLeaderboard(viewerId: string) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { not: 'ADMIN' } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberProfile: { select: { businessName: true, industry: true, photoUrl: true } },
    },
  });

  const now = new Date();
  const [invites, deals, contracts, referrals, hostCalls, guestCalls] = await Promise.all([
    prisma.referralTracking.groupBy({
      by: ['referrerUserId'],
      where: { status: { in: ['onboarded', 'paid'] } },
      _count: { _all: true },
    }),
    prisma.pipelineCard.groupBy({
      by: ['ownerId'],
      where: { stage: 'won' },
      _count: { _all: true },
    }),
    prisma.contract.groupBy({
      by: ['senderId'],
      where: { status: 'signed' },
      _count: { _all: true },
    }),
    prisma.referral.groupBy({ by: ['senderId'], _count: { _all: true } }),
    prisma.bookingCall.groupBy({
      by: ['hostId'],
      where: { status: { in: ['confirmed', 'completed'] }, endsAt: { lt: now } },
      _count: { _all: true },
    }),
    prisma.bookingCall.groupBy({
      by: ['guestId'],
      where: { status: { in: ['confirmed', 'completed'] }, endsAt: { lt: now } },
      _count: { _all: true },
    }),
  ]);

  const inviteMap = new Map(invites.map((r) => [r.referrerUserId, r._count._all]));
  const dealMap = new Map(deals.map((r) => [r.ownerId, r._count._all]));
  const contractMap = new Map(contracts.map((r) => [r.senderId, r._count._all]));
  const referralMap = new Map(referrals.map((r) => [r.senderId, r._count._all]));
  const hostCallMap = new Map(hostCalls.map((r) => [r.hostId, r._count._all]));
  const guestCallMap = new Map(guestCalls.map((r) => [r.guestId, r._count._all]));

  const rows = users.map((u, idx) => {
    const invitesOnboarded = inviteMap.get(u.id) ?? 0;
    const dealsWon = dealMap.get(u.id) ?? 0;
    const contractsSigned = contractMap.get(u.id) ?? 0;
    const referralsSent = referralMap.get(u.id) ?? 0;
    const callsHeld = (hostCallMap.get(u.id) ?? 0) + (guestCallMap.get(u.id) ?? 0);
    const points =
      invitesOnboarded * LEADERBOARD_POINTS.inviteOnboarded +
      dealsWon * LEADERBOARD_POINTS.dealWon +
      contractsSigned * LEADERBOARD_POINTS.contractSigned +
      referralsSent * LEADERBOARD_POINTS.referralSent +
      callsHeld * LEADERBOARD_POINTS.callHeld;
    const isFounding = idx < FOUNDING_MEMBER_LIMIT;
    return {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      businessName: u.memberProfile?.businessName ?? null,
      industry: u.memberProfile?.industry ?? null,
      photoUrl: u.memberProfile?.photoUrl ?? null,
      isFounding,
      invitesOnboarded,
      dealsWon,
      contractsSigned,
      referralsSent,
      callsHeld,
      points,
      badges: badgesFor(invitesOnboarded, isFounding),
    };
  });

  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));

  const me = ranked.find((r) => r.userId === viewerId) ?? null;
  const [pendingInvites, viewer] = await Promise.all([
    prisma.referralTracking.count({
      where: { referrerUserId: viewerId, status: { in: ['invited', 'signed_up'] } },
    }),
    prisma.user.findUnique({ where: { id: viewerId }, select: { referralRewardMonths: true } }),
  ]);
  const origin = env.FRONTEND_URL.split(',')[0] ?? 'https://dashboard.referralnova.com';

  return {
    members: ranked.slice(0, 50),
    totalMembers: ranked.length,
    points: LEADERBOARD_POINTS,
    me: me
      ? {
          ...me,
          invitesPending: pendingInvites,
          rewardMonths: viewer?.referralRewardMonths ?? 0,
          inviteUrl: `${origin}/signup?ref=${viewerId}`,
        }
      : null,
  };
}

/** Badge ladder driven by successful (onboarded) invites. */
function badgesFor(invitesOnboarded: number, founding: boolean): string[] {
  const badges: string[] = [];
  if (founding) badges.push('Founding member');
  if (invitesOnboarded >= 1) badges.push('Connector');
  if (invitesOnboarded >= 3) badges.push('Priority matching');
  if (invitesOnboarded >= 5) badges.push('Ambassador');
  if (invitesOnboarded >= 10 && founding) badges.push('Founding Ambassador');
  return badges;
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
