/**
 * Subscription tier caps + feature gates. The source of truth for "what can
 * a FREE user do that a PRO user can do more of."
 *
 * `enforceLeadCap` is called by the matching/leads service before a lead is
 * assigned. `planFor` is the marketing-facing summary used by /pricing.
 */

import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

export type Tier = 'FREE' | 'PRO' | 'PREMIUM';

/**
 * Free-plan engagement allowance. After the founding 200 (who are PREMIUM), a
 * FREE member can send up to this many intro requests AND start up to this many
 * conversations. Beyond that they must upgrade to Pro to reach new people.
 * Messages inside conversations they already have stay open; PRO/PREMIUM (incl.
 * founding members, who are PREMIUM) are unlimited.
 */
export const FREE_ENGAGEMENT_LIMIT = 3;

export async function assertEngagementQuota(
  userId: string,
  kind: 'intro' | 'conversation',
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });
  const tier = (user?.subscriptionTier ?? 'FREE') as Tier;
  if (tier !== 'FREE') return; // Pro/Premium/founding: unlimited

  if (kind === 'intro') {
    const used = await prisma.introduction.count({
      where: { senderId: userId, status: { in: ['requested', 'accepted', 'completed'] } },
    });
    if (used >= FREE_ENGAGEMENT_LIMIT) {
      throw new AppError(
        `Your free plan includes ${FREE_ENGAGEMENT_LIMIT} intro requests. Upgrade to Pro to request more introductions.`,
        403,
        'billing/free_quota_reached',
      );
    }
    return;
  }

  const used = await prisma.conversation.count({
    where: { participants: { some: { userId } } },
  });
  if (used >= FREE_ENGAGEMENT_LIMIT) {
    throw new AppError(
      `Your free plan includes ${FREE_ENGAGEMENT_LIMIT} conversations. Upgrade to Pro to start new conversations.`,
      403,
      'billing/free_quota_reached',
    );
  }
}

export interface TierCaps {
  name: string;
  pricePerMonthCents: number;
  maxLeadsPerMonth: number; // Infinity means unlimited
  maxListings: number;
  maxGroupMemberships: number;
  canSendInvitations: boolean;
  canSeeRankingDetails: boolean;
  prioritizedInRanking: boolean;
  stripePriceIdEnvKey?: 'STRIPE_PRO_PRICE_ID' | 'STRIPE_PREMIUM_PRICE_ID';
}

export const TIERS: Record<Tier, TierCaps> = {
  FREE: {
    name: 'Free',
    pricePerMonthCents: 0,
    maxLeadsPerMonth: 3,
    maxListings: 1,
    maxGroupMemberships: 2,
    canSendInvitations: true,
    canSeeRankingDetails: false,
    prioritizedInRanking: false,
  },
  PRO: {
    name: 'Pro',
    pricePerMonthCents: 4900,
    maxLeadsPerMonth: 30,
    maxListings: 3,
    maxGroupMemberships: 10,
    canSendInvitations: true,
    canSeeRankingDetails: true,
    prioritizedInRanking: false,
    stripePriceIdEnvKey: 'STRIPE_PRO_PRICE_ID',
  },
  PREMIUM: {
    name: 'Premium',
    pricePerMonthCents: 14900,
    maxLeadsPerMonth: Number.POSITIVE_INFINITY,
    maxListings: 10,
    maxGroupMemberships: Number.POSITIVE_INFINITY,
    canSendInvitations: true,
    canSeeRankingDetails: true,
    prioritizedInRanking: true,
    stripePriceIdEnvKey: 'STRIPE_PREMIUM_PRICE_ID',
  },
};

export function planFor(tier: Tier): TierCaps {
  return TIERS[tier];
}

/**
 * Returns true if the user can accept one more lead this calendar month.
 */
export async function canReceiveMoreLeads(userId: string): Promise<{
  allowed: boolean;
  used: number;
  cap: number | null;
  tier: Tier;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });
  const tier = (user?.subscriptionTier ?? 'FREE') as Tier;
  const caps = TIERS[tier];

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const used = await prisma.consumerLead.count({
    where: {
      listing: { userId },
      createdAt: { gte: startOfMonth },
    },
  });

  return {
    allowed: used < caps.maxLeadsPerMonth,
    used,
    // Infinity (PREMIUM/unlimited) serializes to null in JSON - expose it as
    // null explicitly so clients get "unlimited" rather than a broken value.
    cap: Number.isFinite(caps.maxLeadsPerMonth) ? caps.maxLeadsPerMonth : null,
    tier,
  };
}
