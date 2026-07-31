import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { getMemberRewards, redeemReward } from './rewards.service.js';

export const rewardsRouter: Router = Router();
rewardsRouter.use(authenticate);

// The member's rewards store: balance, buyable rewards, active unlocks.
rewardsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await getMemberRewards(req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const redeemSchema = z.object({ rewardKey: z.string().trim().min(1).max(60) });
rewardsRouter.post(
  '/redeem',
  validate(redeemSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await redeemReward(req.user.id, req.body.rewardKey);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
