import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  acceptInvitation,
  getInvitationByToken,
  listSentInvitations,
  revokeInvitation,
  sendInvitation,
} from './invitations.service.js';

export const invitationsRouter: Router = Router();

// ---- Public (no auth) -------------------------------------------------------
// Token-based lookup powers the accept-invite landing page before the user
// signs up. Everything below this point requires auth.

invitationsRouter.get(
  '/public/:token',
  asyncHandler(async (req, res) => {
    const inv = await getInvitationByToken(req.params.token ?? '');
    const body: ApiResponse<typeof inv> = { success: true, data: inv };
    res.json(body);
  }),
);

// ---- Authed ----------------------------------------------------------------
invitationsRouter.use(authenticate);

const sendSchema = z.object({
  recipientEmail: z.string().trim().email(),
  message: z.string().trim().max(500).optional(),
});

invitationsRouter.post(
  '/',
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const inv = await sendInvitation(req.user.id, req.body.recipientEmail, req.body.message);
    const body: ApiResponse<typeof inv> = { success: true, data: inv };
    res.status(201).json(body);
  }),
);

invitationsRouter.get(
  '/sent',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const invs = await listSentInvitations(req.user.id);
    const body: ApiResponse<typeof invs> = { success: true, data: invs };
    res.json(body);
  }),
);

invitationsRouter.post(
  '/:token/accept',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await acceptInvitation(req.params.token ?? '', req.user.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

invitationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const inv = await revokeInvitation(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof inv> = { success: true, data: inv };
    res.json(body);
  }),
);
