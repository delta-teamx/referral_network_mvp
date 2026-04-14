/**
 * Subscription tier constants. Keep in sync with the `SubscriptionTier` enum
 * in the Prisma schema and Stripe product definitions (Branch 5).
 */
export const SUBSCRIPTION_TIERS = ['FREE', 'PRO', 'PREMIUM'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export interface SubscriptionTierLimits {
  maxPhotos: number | 'unlimited';
  maxReferralsPerMonth: number | 'unlimited';
  maxGroups: number | 'unlimited';
  maxLifeEventLeadsPerMonth: number | 'unlimited';
  verifiedBadge: boolean;
  sponsoredPlacement: boolean;
  prioritySupport: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, SubscriptionTierLimits> = {
  FREE: {
    maxPhotos: 3,
    maxReferralsPerMonth: 5,
    maxGroups: 1,
    maxLifeEventLeadsPerMonth: 0,
    verifiedBadge: false,
    sponsoredPlacement: false,
    prioritySupport: false,
  },
  PRO: {
    maxPhotos: 15,
    maxReferralsPerMonth: 'unlimited',
    maxGroups: 5,
    maxLifeEventLeadsPerMonth: 5,
    verifiedBadge: true,
    sponsoredPlacement: false,
    prioritySupport: false,
  },
  PREMIUM: {
    maxPhotos: 'unlimited',
    maxReferralsPerMonth: 'unlimited',
    maxGroups: 'unlimited',
    maxLifeEventLeadsPerMonth: 'unlimited',
    verifiedBadge: true,
    sponsoredPlacement: true,
    prioritySupport: true,
  },
};

export const TIER_PRICING_USD: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 29,
  PREMIUM: 79,
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 1,
  PREMIUM: 2,
};

/** Returns true if `actual` meets or exceeds the `required` tier. */
export function tierMeets(actual: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}
