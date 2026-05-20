import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { getPublicKey, isPushEnabled, removeSubscription, saveSubscription } from './push.service.js';

export const pushRouter: Router = Router();

pushRouter.get(
  '/public-key',
  asyncHandler(async (_req, res) => {
    const key = getPublicKey();
    const body: ApiResponse<{ publicKey: string | null; enabled: boolean }> = {
      success: true,
      data: { publicKey: key, enabled: isPushEnabled() },
    };
    res.json(body);
  }),
);

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(8).max(256),
    auth: z.string().min(8).max(128),
  }),
});

pushRouter.post(
  '/subscribe',
  authenticate,
  validate(subscribeSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await saveSubscription({
      userId: req.user.id,
      endpoint: req.body.endpoint,
      p256dh: req.body.keys.p256dh,
      auth: req.body.keys.auth,
      userAgent: req.header('user-agent') ?? null,
    });
    const body: ApiResponse<{ subscribed: true }> = { success: true, data: { subscribed: true } };
    res.json(body);
  }),
);

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1024) });
pushRouter.post(
  '/unsubscribe',
  authenticate,
  validate(unsubscribeSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await removeSubscription(req.user.id, req.body.endpoint);
    const body: ApiResponse<{ unsubscribed: true }> = { success: true, data: { unsubscribed: true } };
    res.json(body);
  }),
);
