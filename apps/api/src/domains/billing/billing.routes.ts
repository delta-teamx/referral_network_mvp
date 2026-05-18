import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { createCheckoutSession, finaliseUpgrade } from './billing.service.js';
import { canReceiveMoreLeads, TIERS, type Tier } from './billing.tiers.js';

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

const finaliseSchema = z.object({ tier: z.enum(['PRO', 'PREMIUM']) });

billingRouter.post(
  '/finalise-demo',
  validate(finaliseSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await finaliseUpgrade(req.user.id, req.body.tier as Tier);
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
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
