import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { getAnalytics, getOwnerMetrics } from './dashboard.service.js';

export const dashboardRouter: Router = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const metrics = await getOwnerMetrics(req.user.id);
    const body: ApiResponse<typeof metrics> = { success: true, data: metrics };
    res.json(body);
  }),
);

dashboardRouter.get(
  '/analytics',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const analytics = await getAnalytics(req.user.id);
    const body: ApiResponse<typeof analytics> = { success: true, data: analytics };
    res.json(body);
  }),
);
