import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  getCommunityLeaderboard,
  getReferralStats,
  getTopReferrers,
  resolveReferralCode,
  trackReferral,
} from './referral-tracking.service.js';

export const referralTrackingRouter: Router = Router();

// Public: resolve a /join/<code> short link to the referrer id, so the
// marketing redirect page can attribute the signup. Mounted BEFORE the
// authenticate gate below - anonymous visitors follow invite links.
referralTrackingRouter.get(
  '/resolve/:code',
  asyncHandler(async (req, res) => {
    const ref = await resolveReferralCode(req.params.code ?? '');
    const body: ApiResponse<{ ref: string | null }> = { success: true, data: { ref } };
    res.json(body);
  }),
);

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

// Member-facing community leaderboard (rankings, own stats, invite link).
referralTrackingRouter.get(
  '/community',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    // ?all=1 (admin only): include members who haven't started participating.
    const includeInactive = req.query.all === '1' && req.user.role === 'ADMIN';
    // ?period=all shows the all-time board; default is the current monthly cycle.
    const period = req.query.period === 'all' ? 'all' : 'month';
    const data = await getCommunityLeaderboard(req.user.id, { includeInactive, period });
    const body: ApiResponse<typeof data> = { success: true, data };
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
