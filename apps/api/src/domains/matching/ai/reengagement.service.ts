import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import {
  DORMANT_THRESHOLD,
  listEngagementForAllMembers,
  type EngagementBreakdown,
} from './engagement.service.js';

/**
 * Feature 4 brief: "Re-engagement tool — bulk outreach system to contact
 * inactive members with personalized 'we miss you' messaging + highlight
 * new AI features."
 *
 * Picks every member whose engagement score is below DORMANT_THRESHOLD,
 * counts the new suggested introductions they haven't yet seen, and sends
 * a tailored reengagement email. Skips members with zero new matches —
 * an empty "you have nothing new" email is just spam.
 *
 * dryRun mode returns the would-be recipients without sending so the admin
 * UI can preview the campaign.
 */

export interface ReengagementCampaignResult {
  scanned: number;
  dormant: number;
  emailsSent: number;
  skippedEmpty: number;
  errors: number;
  dryRunRecipients?: Array<{ userId: string; email: string; score: number; newMatches: number }>;
}

export async function runReengagementCampaign(opts: { dryRun?: boolean; now?: Date } = {}): Promise<ReengagementCampaignResult> {
  const now = opts.now ?? new Date();
  const stats: ReengagementCampaignResult = {
    scanned: 0,
    dormant: 0,
    emailsSent: 0,
    skippedEmpty: 0,
    errors: 0,
  };
  if (opts.dryRun) stats.dryRunRecipients = [];

  const breakdowns = await listEngagementForAllMembers(now);
  stats.scanned = breakdowns.length;

  const dormant = breakdowns.filter((b) => b.score < DORMANT_THRESHOLD);
  stats.dormant = dormant.length;
  if (dormant.length === 0) return stats;

  const userIds = dormant.map((b) => b.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true, email: true, firstName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const matchCounts = await prisma.introduction.groupBy({
    by: ['senderId'],
    where: { senderId: { in: userIds }, status: 'suggested' },
    _count: { _all: true },
  });
  const matchCountByUser = new Map(matchCounts.map((m) => [m.senderId, m._count._all]));

  const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
  const matchesUrl = `${origin.replace(/\/$/, '')}/dashboard/matches`;

  for (const breakdown of dormant) {
    const user = userMap.get(breakdown.userId);
    if (!user) continue;
    const newMatches = matchCountByUser.get(breakdown.userId) ?? 0;
    if (newMatches === 0) {
      stats.skippedEmpty++;
      continue;
    }
    if (opts.dryRun) {
      stats.dryRunRecipients!.push({
        userId: user.id,
        email: user.email,
        score: breakdown.score,
        newMatches,
      });
      continue;
    }
    try {
      await sendEmail({
        to: user.email,
        template: 'reengagement',
        data: { firstName: user.firstName, newMatches, matchesUrl },
      });
      stats.emailsSent++;
    } catch (err) {
      stats.errors++;
      // eslint-disable-next-line no-console
      console.error('[reengagement] send failed for', user.id, err);
    }
  }

  return stats;
}

export function buildDormantPreview(breakdowns: EngagementBreakdown[]): EngagementBreakdown[] {
  return breakdowns.filter((b) => b.score < DORMANT_THRESHOLD).sort((a, b) => a.score - b.score);
}
