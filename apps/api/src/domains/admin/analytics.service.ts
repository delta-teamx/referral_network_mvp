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

/**
 * One member's activity snapshot for the admin per-user view: identity, profile
 * completeness, login recency, and real engagement (messages + reply rate,
 * pipeline, referrals, invites, bookings, points) plus their last few messages.
 */
export async function getUserActivity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      subscriptionTier: true,
      createdAt: true,
      lastLoginAt: true,
      memberProfile: {
        select: { photoUrl: true, bio: true, businessName: true, industry: true, videoUrl: true },
      },
    },
  });
  if (!user) return null;

  const myConvoIds = (
    await prisma.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } })
  ).map((c) => c.conversationId);

  const [
    msgsSent,
    referralsSent,
    referralsReceived,
    invitesOnboarded,
    bookingsHost,
    bookingsGuest,
    pipelineByStage,
    contribution,
    repliedConvos,
    recentMessages,
  ] = await Promise.all([
    prisma.message.count({ where: { senderId: userId } }),
    prisma.referral.count({ where: { senderId: userId } }),
    prisma.referral.count({ where: { receiverId: userId } }),
    prisma.referralTracking.count({ where: { referrerUserId: userId, status: { in: ['onboarded', 'paid'] } } }),
    prisma.bookingCall.count({ where: { hostId: userId } }),
    prisma.bookingCall.count({ where: { guestId: userId } }),
    prisma.pipelineCard.groupBy({ by: ['stage'], where: { ownerId: userId }, _count: { _all: true } }),
    prisma.contributionEvent.aggregate({
      where: { userId, type: { not: 'reward_redemption' } },
      _sum: { points: true },
    }),
    myConvoIds.length
      ? prisma.message.findMany({
          where: { conversationId: { in: myConvoIds }, senderId: { not: userId } },
          select: { conversationId: true },
          distinct: ['conversationId'],
        })
      : Promise.resolve([]),
    prisma.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { text: true, createdAt: true },
    }),
  ]);

  const p = user.memberProfile;
  const completeChecks = [Boolean(p?.businessName), Boolean(p?.industry), Boolean(p?.photoUrl), Boolean(p?.bio), Boolean(p?.videoUrl)];
  const profileComplete = Math.round((completeChecks.filter(Boolean).length / completeChecks.length) * 100);

  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.email,
    email: user.email,
    role: user.role,
    tier: user.subscriptionTier,
    joined: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    profileComplete,
    hasPhoto: Boolean(p?.photoUrl),
    hasVideo: Boolean(p?.videoUrl),
    messagesSent: msgsSent,
    conversations: myConvoIds.length,
    replyRate: myConvoIds.length ? Math.round((repliedConvos.length / myConvoIds.length) * 100) : 0,
    referralsSent,
    referralsReceived,
    invitesOnboarded,
    bookings: bookingsHost + bookingsGuest,
    pipeline: Object.fromEntries(pipelineByStage.map((r) => [r.stage, r._count._all])),
    contributionPoints: contribution._sum.points ?? 0,
    recentMessages: recentMessages.map((m) => ({ text: m.text.slice(0, 120), at: m.createdAt })),
  };
}

const DISPOSABLE_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
];

/**
 * Rule-based spam suspects. Combines cheap signals into a score with
 * human-readable reasons so an admin can review and remove. Deliberately
 * conservative - it only FLAGS, never auto-acts. Tuned to be quiet at low
 * volume and useful once the NRG launch pushes traffic up.
 */
export async function getSpamSuspects() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const [users, msgBySender, dupMsgs, refBySender] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null, role: { not: 'ADMIN' }, NOT: { email: { endsWith: '@vpn-demo.com' } } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        memberProfile: { select: { photoUrl: true, bio: true } },
      },
    }),
    prisma.message.groupBy({ by: ['senderId'], _count: { _all: true } }),
    prisma.message.groupBy({
      by: ['senderId', 'text'],
      _count: { _all: true },
      having: { text: { _count: { gte: 3 } } },
    }),
    prisma.referral.groupBy({
      by: ['senderId'],
      where: { createdAt: { gte: new Date(now - 30 * dayMs) } },
      _count: { _all: true },
    }),
  ]);

  const msgCount = new Map(msgBySender.map((r) => [r.senderId, r._count._all]));
  const refCount = new Map(refBySender.map((r) => [r.senderId, r._count._all]));
  const dupMax = new Map<string, number>();
  for (const d of dupMsgs) {
    dupMax.set(d.senderId, Math.max(dupMax.get(d.senderId) ?? 0, d._count._all));
  }

  const suspects: Array<{ userId: string; name: string; email: string; score: number; reasons: string[] }> = [];
  for (const u of users) {
    const reasons: string[] = [];
    let score = 0;
    const msgs = msgCount.get(u.id) ?? 0;
    const refs = refCount.get(u.id) ?? 0;
    const dup = dupMax.get(u.id) ?? 0;
    const ageHrs = (now - u.createdAt.getTime()) / 3_600_000;
    const emptyProfile = !u.memberProfile?.photoUrl && !u.memberProfile?.bio;
    const domain = u.email.split('@')[1]?.toLowerCase() ?? '';

    if (ageHrs < 48 && msgs >= 10) {
      score += 3;
      reasons.push(`${msgs} messages in first 48h`);
    }
    if (refs >= 25) {
      score += 3;
      reasons.push(`${refs} referrals in 30 days`);
    }
    if (dup >= 3) {
      score += 3;
      reasons.push(`same message sent ${dup} times`);
    }
    if (emptyProfile && msgs >= 8) {
      score += 2;
      reasons.push(`${msgs} messages with an empty profile`);
    }
    if (DISPOSABLE_DOMAINS.includes(domain)) {
      score += 2;
      reasons.push('disposable email domain');
    }

    if (score >= 3) {
      suspects.push({
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || u.email,
        email: u.email,
        score,
        reasons,
      });
    }
  }
  suspects.sort((a, b) => b.score - a.score);
  return suspects.slice(0, 50);
}
