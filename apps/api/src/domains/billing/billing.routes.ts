import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { createCheckoutSession, getBillingStatus } from './billing.service.js';
import { canReceiveMoreLeads, TIERS, type Tier } from './billing.tiers.js';
import { getFoundingStatus } from './founding.service.js';

export const billingRouter: Router = Router();

billingRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = (Object.keys(TIERS) as Tier[]).map((tier) => {
      const caps = TIERS[tier];
      return {
        tier,
        name: caps.name,
        pricePerMonthCents: caps.pricePerMonthCents,
        maxLeadsPerMonth:
          caps.maxLeadsPerMonth === Number.POSITIVE_INFINITY ? null : caps.maxLeadsPerMonth,
        maxListings:
          caps.maxListings === Number.POSITIVE_INFINITY ? null : caps.maxListings,
        prioritizedInRanking: caps.prioritizedInRanking,
        canSeeRankingDetails: caps.canSeeRankingDetails,
      };
    });
    const body: ApiResponse<typeof plans> = { success: true, data: plans };
    res.json(body);
  }),
);

// Public - powers the "first 200 businesses free" promo counter on the site.
billingRouter.get(
  '/founding-status',
  asyncHandler(async (_req, res) => {
    const status = await getFoundingStatus();
    const body: ApiResponse<typeof status> = { success: true, data: status };
    res.json(body);
  }),
);

billingRouter.use(authenticate);

const checkoutSchema = z.object({ tier: z.enum(['PRO', 'PREMIUM']) });

billingRouter.post(
  '/checkout',
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await createCheckoutSession(req.user.id, req.body.tier as Tier);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// NOTE: the old POST /finalise-demo endpoint was REMOVED. It flipped a user's
// subscriptionTier with no payment verification, so any logged-in user could
// grant themselves PREMIUM for free. Tier activation now happens exclusively in
// the signature-verified Stripe webhook (billing.webhook.ts) on
// checkout.session.completed. The /billing/success page just re-hydrates to
// pick up the new tier.

// Live plan state incl. unpaid dues (powers the paused-subscription alert).
billingRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const status = await getBillingStatus(req.user.id);
    const body: ApiResponse<typeof status> = { success: true, data: status };
    res.json(body);
  }),
);

billingRouter.get(
  '/quota',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const q = await canReceiveMoreLeads(req.user.id);
    const body: ApiResponse<typeof q> = { success: true, data: q };
    res.json(body);
  }),
);
