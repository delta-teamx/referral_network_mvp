/**
 * Subscription tier caps + feature gates. The source of truth for "what can
 * a FREE user do that a PRO user can do more of."
 *
 * `enforceLeadCap` is called by the matching/leads service before a lead is
 * assigned. `planFor` is the marketing-facing summary used by /pricing.
 */

import { prisma } from '../../config/prisma.js';

export type Tier = 'FREE' | 'PRO' | 'PREMIUM';

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
  cap: number;
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
    cap: caps.maxLeadsPerMonth,
    tier,
  };
}
