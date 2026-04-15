import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  listReferralsReceived,
  listReferralsSent,
  sendReferral,
  updateReferralStatus,
  type ReferralStatus,
} from './referrals.service.js';

export const referralsRouter: Router = Router();
referralsRouter.use(authenticate);

const createReferralSchema = z.object({
  listingSlug: z.string().trim().min(1),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(40).optional(),
  clientEmail: z.string().trim().email().optional(),
  notes: z.string().trim().max(1000).optional(),
});

referralsRouter.post(
  '/',
  validate(createReferralSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const referral = await sendReferral({ ...req.body, senderId: req.user.id });
    const body: ApiResponse<typeof referral> = { success: true, data: referral };
    res.status(201).json(body);
  }),
);

referralsRouter.get(
  '/sent',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const referrals = await listReferralsSent(req.user.id);
    const body: ApiResponse<typeof referrals> = { success: true, data: referrals };
    res.json(body);
  }),
);

referralsRouter.get(
  '/received',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const referrals = await listReferralsReceived(req.user.id);
    const body: ApiResponse<typeof referrals> = { success: true, data: referrals };
    res.json(body);
  }),
);

const statusSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'CONVERTED', 'DECLINED']),
});

referralsRouter.patch(
  '/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await updateReferralStatus(
      req.params.id ?? '',
      req.user.id,
      req.body.status as ReferralStatus,
    );
    const body: ApiResponse<typeof updated> = { success: true, data: updated };
    res.json(body);
  }),
);
