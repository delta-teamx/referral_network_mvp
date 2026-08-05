import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { rateLimit } from '../../../middleware/rateLimit.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  countBroadcastAudience,
  listBroadcasts,
  sendBroadcast,
} from './broadcast.service.js';
import { getWelcomeMessage, setWelcomeMessage } from './welcome.service.js';

/**
 * Admin broadcast (Founder announcement) API. All routes require ADMIN.
 * Sending is rate-limited - a broadcast fans out to every member.
 */
export const broadcastRouter: Router = Router();

broadcastRouter.use(authenticate);
broadcastRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin role required'));
  next();
});

// History + current audience size (for the composer).
broadcastRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [broadcasts, audience] = await Promise.all([listBroadcasts(), countBroadcastAudience()]);
    const body: ApiResponse<{ broadcasts: typeof broadcasts; audience: number }> = {
      success: true,
      data: { broadcasts, audience },
    };
    res.json(body);
  }),
);

const sendSchema = z.object({
  senderName: z.string().trim().min(1).max(80),
  senderTitle: z.string().trim().max(80).optional(),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
});

broadcastRouter.post(
  '/',
  // A broadcast reaches every member - keep it to a few per minute.
  rateLimit({ windowMs: 60_000, max: 5, key: 'broadcast-send' }),
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await sendBroadcast({
      adminId: req.user.id,
      senderName: req.body.senderName,
      senderTitle: req.body.senderTitle,
      subject: req.body.subject,
      body: req.body.body,
    });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

// ── New-member welcome config (auto-sent when a member finishes onboarding) ──
broadcastRouter.get(
  '/welcome',
  asyncHandler(async (_req, res) => {
    const data = await getWelcomeMessage();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const welcomeSchema = z.object({
  enabled: z.boolean().optional(),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().max(5000).optional(),
});

broadcastRouter.put(
  '/welcome',
  validate(welcomeSchema),
  asyncHandler(async (req, res) => {
    const data = await setWelcomeMessage(req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
