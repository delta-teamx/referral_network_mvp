import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate, optionalAuthenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createGroup,
  decideJoinRequest,
  getActiveInviteLink,
  getGroupBySlug,
  joinGroup,
  joinViaInviteLink,
  leaveGroup,
  listGroupMessages,
  listGroups,
  listJoinRequests,
  listMyGroups,
  mintInviteLink,
  postGroupMessage,
  requestToJoin,
  revokeInviteLink,
} from './groups.service.js';

export const groupsRouter: Router = Router();

// Public discovery - no auth required
groupsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = {
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const groups = await listGroups(filters);
    const body: ApiResponse<typeof groups> = { success: true, data: groups };
    res.json(body);
  }),
);

// Optionally authenticated: a signed-in member sees the full interior; a
// visitor (or non-member of a closed group) gets the visible shell only.
groupsRouter.get(
  '/by-slug/:slug',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const group = await getGroupBySlug(req.params.slug ?? '', req.user?.id);
    const body: ApiResponse<typeof group> = { success: true, data: group };
    res.json(body);
  }),
);

// Authenticated endpoints below
groupsRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().length(2),
  meetingSchedule: z.string().trim().max(120).optional(),
  meetingUrl: z.string().trim().url().optional(),
  maxMembers: z.number().int().min(5).max(200).optional(),
  isPublic: z.boolean().optional(),
});

groupsRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const group = await createGroup({ ...req.body, creatorId: req.user.id });
    const body: ApiResponse<typeof group> = { success: true, data: group };
    res.status(201).json(body);
  }),
);

groupsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const groups = await listMyGroups(req.user.id);
    const body: ApiResponse<typeof groups> = { success: true, data: groups };
    res.json(body);
  }),
);

groupsRouter.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await joinGroup(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

groupsRouter.post(
  '/:id/leave',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await leaveGroup(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Group chat - members only
groupsRouter.get(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await listGroupMessages(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const groupMessageSchema = z.object({ text: z.string().trim().min(1).max(2000) });
groupsRouter.post(
  '/:id/messages',
  validate(groupMessageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await postGroupMessage(req.params.id ?? '', req.user.id, req.body.text);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

// White-label settings - leader-only
const whitelabelSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional().nullable(),
  welcomeMessage: z.string().trim().max(500).optional().nullable(),
  billingModel: z.enum(['platform', 'per_seat', 'per_group']).optional(),
  seatPriceCents: z.number().int().min(0).optional().nullable(),
  groupPriceCents: z.number().int().min(0).optional().nullable(),
});

groupsRouter.patch(
  '/:id/settings',
  validate(whitelabelSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { updateGroupSettings } = await import('./groups.service.js');
    const group = await updateGroupSettings(req.params.id ?? '', req.user.id, req.body);
    const body: ApiResponse<typeof group> = { success: true, data: group };
    res.json(body);
  }),
);

// ---- Closed-group access: invite links + request-to-join --------------------

// Join through the shared invite link (auto-join + lifetime Premium).
groupsRouter.post(
  '/join-link/:token',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await joinViaInviteLink(req.params.token ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Request to join a closed group (existing members submit for approval).
const requestSchema = z.object({ message: z.string().trim().max(500).optional() });
groupsRouter.post(
  '/:id/request',
  validate(requestSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await requestToJoin(req.params.id ?? '', req.user.id, req.body.message);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

// ---- Group-admin surface (leaders / co-leaders of the group) ----------------

// Mint a fresh time-boxed shared invite link (default 48h).
const mintSchema = z.object({
  hours: z.number().int().min(1).max(720).optional(),
  grantsPremium: z.boolean().optional(),
});
groupsRouter.post(
  '/:id/invite-link',
  validate(mintSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await mintInviteLink(req.params.id ?? '', req.user.id, req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

// Current active invite link for the group (leaders only).
groupsRouter.get(
  '/:id/invite-link',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await getActiveInviteLink(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Expire the active invite link early (leaders only).
groupsRouter.delete(
  '/:id/invite-link',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await revokeInviteLink(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Pending join requests (leaders only).
groupsRouter.get(
  '/:id/requests',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await listJoinRequests(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Approve or decline a pending request (leaders only).
const decideSchema = z.object({ decision: z.enum(['approve', 'decline']) });
groupsRouter.post(
  '/requests/:requestId/decide',
  validate(decideSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await decideJoinRequest(req.params.requestId ?? '', req.user.id, req.body.decision);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
