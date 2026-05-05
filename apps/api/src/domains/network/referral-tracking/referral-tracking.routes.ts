import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  getReferralStats,
  getTopReferrers,
  trackReferral,
} from './referral-tracking.service.js';

export const referralTrackingRouter: Router = Router();
referralTrackingRouter.use(authenticate);

const trackSchema = z.object({
  inviteeEmail: z.string().trim().toLowerCase().email(),
  source: z.enum(['direct', 'event', 'webinar', 'link']).optional(),
  eventId: z.string().optional(),
});

referralTrackingRouter.post(
  '/track',
  validate(trackSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await trackReferral({
      referrerUserId: req.user.id,
      inviteeEmail: req.body.inviteeEmail,
      source: req.body.source,
      eventId: req.body.eventId,
    });
    const body: ApiResponse<{ tracked: true }> = { success: true, data: { tracked: true } };
    res.json(body);
  }),
);

referralTrackingRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const stats = await getReferralStats(req.user.id);
    const body: ApiResponse<typeof stats> = { success: true, data: stats };
    res.json(body);
  }),
);

referralTrackingRouter.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const data = await getTopReferrers();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
