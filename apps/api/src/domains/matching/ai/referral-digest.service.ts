import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { env } from '../../../config/env.js';

/**
 * Weekly referral digest. The matches scheduler tops up onboarding referrals
 * daily and (on Mondays) calls sendWeeklyReferralDigestForAllMembers, which
 * emails each member their top still-actionable suggestions for the week.
 *
 * Selection: the highest-scoring suggested Introductions where the member is
 * the sender. Caps at DIGEST_LIMIT entries. Skips members with zero active
 * suggestions (no point in a "you have 0 matches" email).
 *
 * Per-user failures are caught so one bad row doesn't stop the fan-out.
 */

export const DIGEST_LIMIT = 8;

export interface DigestRun {
  membersConsidered: number;
  emailsSent: number;
  skippedEmpty: number;
  errors: number;
}

export async function sendWeeklyReferralDigestForAllMembers(): Promise<DigestRun> {
  const stats: DigestRun = {
    membersConsidered: 0,
    emailsSent: 0,
    skippedEmpty: 0,
    errors: 0,
  };

  const members = await prisma.user.findMany({
    where: { deletedAt: null, memberProfile: { isNot: null } },
    select: { id: true, email: true, firstName: true },
  });
  stats.membersConsidered = members.length;

  for (const member of members) {
    try {
      const sent = await sendWeeklyReferralDigest(member.id);
      if (sent) stats.emailsSent++;
      else stats.skippedEmpty++;
    } catch (err) {
      stats.errors++;
      // eslint-disable-next-line no-console
      console.error('[referral-digest] failed for', member.id, err);
    }
  }

  // eslint-disable-next-line no-console
  console.log('[referral-digest] run complete', stats);
  return stats;
}

export async function sendWeeklyReferralDigest(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return false;

  const suggestions = await prisma.introduction.findMany({
    where: { senderId: userId, status: 'suggested' },
    orderBy: { matchScore: 'desc' },
    take: DIGEST_LIMIT,
    select: {
      id: true,
      matchScore: true,
      reason: true,
      target: {
        select: {
          firstName: true,
          lastName: true,
          memberProfile: {
            select: { businessName: true, industry: true, city: true, state: true },
          },
        },
      },
    },
  });

  if (suggestions.length === 0) return false;

  const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
  const dashboardUrl = `${origin.replace(/\/$/, '')}/dashboard/matches`;

  const items = suggestions.map((s) => ({
    name: `${s.target.firstName} ${s.target.lastName}`.trim(),
    business: s.target.memberProfile?.businessName ?? '',
    industry: s.target.memberProfile?.industry ?? '',
    location: [s.target.memberProfile?.city, s.target.memberProfile?.state]
      .filter(Boolean)
      .join(', '),
    score: Math.round(Number(s.matchScore)),
    reason: s.reason ?? '',
    url: `${origin.replace(/\/$/, '')}/dashboard/profile/${s.id}`,
  }));

  await sendEmail({
    to: user.email,
    template: 'weekly_referral_digest',
    data: {
      firstName: user.firstName,
      count: items.length,
      items,
      dashboardUrl,
    },
  });

  return true;
}
