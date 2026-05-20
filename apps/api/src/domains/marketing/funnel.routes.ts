import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { getFunnelStats, logFunnelCta, logFunnelView } from './funnel.service.js';

/**
 * Public lead-gen funnel endpoints. View + CTA logging are intentionally
 * unauthenticated — the preview page is public.
 */
export const funnelRouter: Router = Router();

const viewSchema = z.object({
  sessionId: z.string().min(8).max(64),
  referrer: z.string().max(512).nullable().optional(),
  campaign: z.string().max(128).nullable().optional(),
});

funnelRouter.post(
  '/view',
  validate(viewSchema),
  asyncHandler(async (req, res) => {
    await logFunnelView({
      sessionId: req.body.sessionId,
      referrer: req.body.referrer ?? null,
      campaign: req.body.campaign ?? null,
    });
    res.json({ success: true } satisfies ApiResponse<unknown>);
  }),
);

const ctaSchema = z.object({
  sessionId: z.string().min(8).max(64),
  cta: z.enum(['join', 'share', 'view_match']),
});

funnelRouter.post(
  '/cta',
  validate(ctaSchema),
  asyncHandler(async (req, res) => {
    await logFunnelCta({ sessionId: req.body.sessionId, cta: req.body.cta });
    res.json({ success: true } satisfies ApiResponse<unknown>);
  }),
);

// Admin: funnel performance.
funnelRouter.get(
  '/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const sinceParam = typeof req.query.since === 'string' ? new Date(req.query.since) : undefined;
    const stats = await getFunnelStats({ since: sinceParam });
    const body: ApiResponse<typeof stats> = { success: true, data: stats };
    res.json(body);
  }),
);
