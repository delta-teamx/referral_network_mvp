import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { listPods, runDailyMatchmaking, submitPodFeedback } from './pods.service.js';

export const podsRouter: Router = Router();

// Admin: trigger matchmaking manually
podsRouter.post(
  '/trigger',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const result = await runDailyMatchmaking();
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Admin: list all pods
podsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const data = await listPods({ status });
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Member: submit feedback after a pod meeting
const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wouldMeetAgain: z.boolean(),
  highlights: z.string().trim().max(500).optional(),
});

podsRouter.post(
  '/:podId/feedback',
  authenticate,
  validate(feedbackSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await submitPodFeedback(
      req.params.podId ?? '',
      req.user.id,
      req.body.rating,
      req.body.wouldMeetAgain,
      req.body.highlights,
    );
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
