import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  archiveConnection,
  getConnectionState,
  listConnections,
  requestConnection,
  respondToConnection,
  type ConnectionStatus,
} from './connections.service.js';

export const connectionsRouter: Router = Router();
connectionsRouter.use(authenticate);

const requestSchema = z.object({
  targetUserId: z.string().uuid(),
});

connectionsRouter.post(
  '/request',
  validate(requestSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const conn = await requestConnection(req.user.id, req.body.targetUserId);
    const body: ApiResponse<typeof conn> = { success: true, data: conn };
    res.status(201).json(body);
  }),
);

const respondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

connectionsRouter.post(
  '/:id/respond',
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const conn = await respondToConnection(
      req.params.id ?? '',
      req.user.id,
      req.body.action as 'accept' | 'decline',
    );
    const body: ApiResponse<typeof conn> = { success: true, data: conn };
    res.json(body);
  }),
);

const listQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'archived']).optional(),
});

connectionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const parsed = listQuerySchema.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;
    const conns = await listConnections(req.user.id, status as ConnectionStatus | undefined);
    const body: ApiResponse<typeof conns> = { success: true, data: conns };
    res.json(body);
  }),
);

connectionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const conn = await archiveConnection(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof conn> = { success: true, data: conn };
    res.json(body);
  }),
);

connectionsRouter.get(
  '/state/:otherUserId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const state = await getConnectionState(req.user.id, req.params.otherUserId ?? '');
    const body: ApiResponse<{ state: typeof state }> = { success: true, data: { state } };
    res.json(body);
  }),
);
