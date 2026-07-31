import { prisma } from '../../config/prisma.js';

/**
 * Admin analytics for the referral + rewards funnel. Read-only aggregations
 * over existing data (invites, referrals + verification, contribution ledger,
 * reward redemptions, tier mix). Powers the admin Analytics page.
 */

const ROUL_EMAIL = 'roul-support@referralnova.com';

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export async function computeReferralAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    tierRows,
    totalMembers,
    inviteRows,
    referralStatusRows,
    referralRelevanceRows,
    totalReferrals,
    rewardTypeRows,
    contributionAwarded,
    topContributorRows,
    highActivity,
  ] = await Promise.all([
    // Tier mix (genuine members only).
    prisma.user.groupBy({
      by: ['subscriptionTier'],
      where: { deletedAt: null, role: { not: 'ADMIN' }, NOT: { email: ROUL_EMAIL } },
      _count: { _all: true },
    }),
    prisma.user.count({
      where: { deletedAt: null, role: { not: 'ADMIN' }, NOT: { email: ROUL_EMAIL } },
    }),
    // Invite funnel from ReferralTracking.
    prisma.referralTracking.groupBy({ by: ['status'], _count: { _all: true } }),
    // Referral status + relevance funnel.
    prisma.referral.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.referral.groupBy({ by: ['relevance'], _count: { _all: true } }),
    prisma.referral.count(),
    // Reward redemptions by type.
    prisma.rewardRedemption.groupBy({ by: ['type'], _count: { _all: true } }),
    // Total contribution points awarded (excludes reward spends).
    prisma.contributionEvent.aggregate({
      where: { type: { not: 'reward_redemption' } },
      _sum: { points: true },
    }),
    // Top contributors by verified contribution points.
    prisma.contributionEvent.groupBy({
      by: ['userId'],
      where: { type: { not: 'reward_redemption' } },
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 10,
    }),
    // Possible abuse: members who sent an unusually high number of referrals in
    // the last 30 days.
    prisma.referral.groupBy({
      by: ['senderId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      having: { senderId: { _count: { gte: 25 } } },
      orderBy: { _count: { senderId: 'desc' } },
      take: 10,
    }),
  ]);

  const tier = Object.fromEntries(tierRows.map((r) => [r.subscriptionTier, r._count._all]));
  const invite = Object.fromEntries(inviteRows.map((r) => [r.status, r._count._all]));
  const refStatus = Object.fromEntries(referralStatusRows.map((r) => [r.status, r._count._all]));
  const refRel = Object.fromEntries(
    referralRelevanceRows.map((r) => [r.relevance ?? 'unverified', r._count._all]),
  );

  const invitesSent = inviteRows.reduce((s, r) => s + r._count._all, 0);
  const invitesOnboarded = (invite.onboarded ?? 0) + (invite.paid ?? 0);

  const accepted = (refStatus.ACCEPTED ?? 0) + (refStatus.CONVERTED ?? 0);
  const relevant = (refRel.relevant ?? 0) + (refRel.opportunity ?? 0);
  const opportunity = refRel.opportunity ?? 0;
  const business = refStatus.CONVERTED ?? 0;

  // Names for the leaderboards.
  const contributorIds = topContributorRows.map((r) => r.userId);
  const abuseIds = highActivity.map((r) => r.senderId);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set([...contributorIds, ...abuseIds])] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}`.trim() || u.email : 'Unknown';
  };

  return {
    members: {
      total: totalMembers,
      free: tier.FREE ?? 0,
      pro: tier.PRO ?? 0,
      premium: tier.PREMIUM ?? 0,
    },
    invites: {
      sent: invitesSent,
      signedUp: (invite.signed_up ?? 0) + invitesOnboarded,
      onboarded: invitesOnboarded,
    },
    referrals: {
      total: totalReferrals,
      accepted,
      relevant,
      opportunity,
      business,
      declined: refStatus.DECLINED ?? 0,
      unverified: refRel.unverified ?? 0,
      acceptedPct: pct(accepted, totalReferrals),
      relevantPct: pct(relevant, totalReferrals),
    },
    rewards: {
      total: rewardTypeRows.reduce((s, r) => s + r._count._all, 0),
      byType: Object.fromEntries(rewardTypeRows.map((r) => [r.type, r._count._all])),
    },
    contribution: { pointsAwarded: contributionAwarded._sum.points ?? 0 },
    topContributors: topContributorRows.map((r) => ({
      userId: r.userId,
      name: nameOf(r.userId),
      points: r._sum.points ?? 0,
    })),
    watchlist: highActivity.map((r) => ({
      userId: r.senderId,
      name: nameOf(r.senderId),
      referrals30d: r._count._all,
    })),
  };
}
