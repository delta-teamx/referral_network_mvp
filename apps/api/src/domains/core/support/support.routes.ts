import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { uploadAttachmentObject } from '../../network/messaging/messaging.service.js';
import { authenticate, optionalAuthenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  addVisitorMessage,
  agentReply,
  createTicket,
  deleteTicket,
  getTicket,
  isSupportOnline,
  listTickets,
  setTicketStatus,
} from './support.service.js';

export const supportRouter: Router = Router();

// Widget bootstrap: is a human online right now?
supportRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const body: ApiResponse<{ online: boolean }> = {
      success: true,
      data: { online: isSupportOnline() },
    };
    res.json(body);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  topic: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
});
supportRouter.post(
  '/tickets',
  optionalAuthenticate,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const ticket = await createTicket({ ...req.body, userId: req.user?.id });
    const body: ApiResponse<typeof ticket> = { success: true, data: ticket };
    res.status(201).json(body);
  }),
);

// The ticket uuid doubles as the anonymous visitor's access token; a
// signed-in caller must own the ticket (or be an admin).
supportRouter.get(
  '/tickets/:id',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const ticket = await getTicket(req.params.id ?? '', req.user);
    const body: ApiResponse<typeof ticket> = { success: true, data: ticket };
    res.json(body);
  }),
);

// Attachment upload - same server-side S3 proxy the chat uses (no bucket
// CORS involved). Works for the visitor widget AND the admin console; the
// resulting key is served by the existing public attachment proxy.
supportRouter.post(
  '/tickets/:id/attachments/upload',
  express.raw({ type: '*/*', limit: '16mb' }),
  asyncHandler(async (req, res) => {
    const filename = typeof req.query.filename === 'string' ? req.query.filename : 'file';
    const contentType =
      typeof req.query.contentType === 'string'
        ? req.query.contentType
        : (req.headers['content-type'] ?? 'application/octet-stream');
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const result = await uploadAttachmentObject(
      'support',
      req.params.id ?? 'unknown',
      filename,
      contentType,
      data,
    );
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

const messageSchema = z.object({ text: z.string().trim().min(1).max(4000) });
supportRouter.post(
  '/tickets/:id/messages',
  optionalAuthenticate,
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    const ticket = await addVisitorMessage(req.params.id ?? '', req.body.text, req.user);
    const body: ApiResponse<typeof ticket> = { success: true, data: ticket };
    res.json(body);
  }),
);

// ── Admin console ───────────────────────────────────────────────────────────

supportRouter.get(
  '/admin/tickets',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const tickets = await listTickets(typeof req.query.status === 'string' ? req.query.status : undefined);
    const body: ApiResponse<typeof tickets> = { success: true, data: tickets };
    res.json(body);
  }),
);

supportRouter.post(
  '/admin/tickets/:id/reply',
  authenticate,
  validate(messageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const ticket = await agentReply(req.params.id ?? '', req.body.text);
    const body: ApiResponse<typeof ticket> = { success: true, data: ticket };
    res.json(body);
  }),
);

// Irreversible: remove the ticket, its thread and its stored files.
supportRouter.delete(
  '/admin/tickets/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const result = await deleteTicket(req.params.id ?? '');
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

const statusSchema = z.object({ status: z.enum(['open', 'pending', 'closed']) });
supportRouter.patch(
  '/admin/tickets/:id',
  authenticate,
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const ticket = await setTicketStatus(req.params.id ?? '', req.body.status);
    const body: ApiResponse<typeof ticket> = { success: true, data: ticket };
    res.json(body);
  }),
);
