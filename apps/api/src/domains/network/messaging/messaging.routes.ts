import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  sendMessage,
} from './messaging.service.js';

export const messagingRouter: Router = Router();
messagingRouter.use(authenticate);

// ---- List all conversations for the authenticated user --------------------

messagingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const conversations = await listConversations(req.user.id);
    const body: ApiResponse<typeof conversations> = { success: true, data: conversations };
    res.json(body);
  }),
);

// ---- Get messages for a conversation -------------------------------------

messagingRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
    const messages = await listMessages(req.params.id ?? '', req.user.id, limit);
    const body: ApiResponse<typeof messages> = { success: true, data: messages };
    res.json(body);
  }),
);

// ---- Send a message in a conversation ------------------------------------

const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

messagingRouter.post(
  '/:id/messages',
  validate(sendMessageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const message = await sendMessage(req.params.id ?? '', req.user.id, req.body.text);
    const body: ApiResponse<typeof message> = { success: true, data: message };
    res.status(201).json(body);
  }),
);

// ---- Start (or resume) a conversation with another user ------------------

const startSchema = z.object({
  targetUserId: z.string().uuid(),
});

messagingRouter.post(
  '/start',
  validate(startSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const conversation = await getOrCreateConversation(req.user.id, req.body.targetUserId);
    const body: ApiResponse<typeof conversation> = { success: true, data: conversation };
    res.status(200).json(body);
  }),
);
