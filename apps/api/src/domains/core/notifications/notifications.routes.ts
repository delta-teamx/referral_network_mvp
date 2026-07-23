import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  ensureBookingReminders,
  listNotifications,
  markAllRead,
  markRead,
  markReadByTypes,
  unreadCount,
} from './notifications.service.js';

export const notificationsRouter: Router = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const items = await listNotifications(req.user.id);
    const body: ApiResponse<typeof items> = { success: true, data: items };
    res.json(body);
  }),
);

notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    // Piggyback on the bell's 30s poll to surface upcoming-call reminders.
    await ensureBookingReminders(req.user.id).catch(() => undefined);
    const count = await unreadCount(req.user.id);
    const body: ApiResponse<{ count: number }> = { success: true, data: { count } };
    res.json(body);
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await markRead(req.user.id, req.params.id ?? '');
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);

const readByTypesSchema = z.object({ types: z.array(z.string().min(1)).min(1).max(20) });
notificationsRouter.post(
  '/read-by-types',
  validate(readByTypesSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await markReadByTypes(req.user.id, req.body.types);
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await markAllRead(req.user.id);
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);
