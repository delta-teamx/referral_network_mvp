import type { RequestHandler } from 'express';
import type { SubscriptionTier } from '@refnet/shared';
import { AppError } from '../utils/AppError.js';

/**
 * `requireTier(min)` - gate a route on the caller's subscription tier.
 *
 * Tiers are ordered FREE < PRO < PREMIUM, so `requireTier('PRO')` admits both
 * PRO and PREMIUM members. This is the SERVER-SIDE enforcement for features the
 * UI gates with <UpgradeGate> (e.g. in-app messaging): the client blur is only
 * cosmetic, so without this a FREE user could call the endpoint directly.
 *
 * Expects `req.user` populated by `authenticate`.
 */
const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  PRO: 1,
  PREMIUM: 2,
};

export function requireTier(min: Exclude<SubscriptionTier, 'FREE'>): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('Authentication required'));
    const have = TIER_RANK[req.user.subscriptionTier] ?? 0;
    if (have >= TIER_RANK[min]) return next();
    next(
      new AppError(
        `This feature requires the ${min} plan. Upgrade to continue.`,
        403,
        'billing/tier_required',
      ),
    );
  };
}
