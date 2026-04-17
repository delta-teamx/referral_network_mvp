import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  listNotifications,
  markAllRead,
  markRead,
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

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await markAllRead(req.user.id);
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);
