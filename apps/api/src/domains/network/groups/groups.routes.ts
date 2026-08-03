import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { uploadGroupLogo } from '../profiles/video.service.js';
import { authenticate, optionalAuthenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createAnnouncement,
  createGroup,
  createGroupEvent,
  decideJoinRequest,
  deleteAnnouncement,
  deleteGroupEvent,
  getActiveInviteLink,
  getGroupBySlug,
  joinGroup,
  joinViaInviteLink,
  leaveGroup,
  listAnnouncements,
  listGroupEvents,
  listGroupMessages,
  listGroups,
  listJoinRequests,
  listMyGroups,
  mintInviteLink,
  postGroupMessage,
  requestToJoin,
  revokeInviteLink,
  toggleEventRsvp,
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
    // Groups are officially declared by the platform admin only - members can
    // no longer spin up their own groups.
    if (req.user.role !== 'ADMIN') {
      throw AppError.forbidden('Only an administrator can create a group.');
    }
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

// Group profile + white-label settings - leader-only
const whitelabelSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  meetingSchedule: z.string().trim().max(120).optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal('')),
  primaryColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional().nullable(),
  welcomeMessage: z.string().trim().max(1000).optional().nullable(),
  billingModel: z.enum(['platform', 'per_seat', 'per_group']).optional(),
  seatPriceCents: z.number().int().min(0).optional().nullable(),
  groupPriceCents: z.number().int().min(0).optional().nullable(),
});

// Full profile for the leader's editor.
groupsRouter.get(
  '/:id/profile',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { getGroupProfileForEdit } = await import('./groups.service.js');
    const data = await getGroupProfileForEdit(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

groupsRouter.patch(
  '/:id/settings',
  validate(whitelabelSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const { updateGroupSettings } = await import('./groups.service.js');
    const payload = { ...req.body };
    if (payload.logoUrl === '') payload.logoUrl = null;
    const group = await updateGroupSettings(req.params.id ?? '', req.user.id, payload);
    const body: ApiResponse<typeof group> = { success: true, data: group };
    res.json(body);
  }),
);

// Group logo upload - leader sends the image bytes; we store + set logoUrl.
groupsRouter.post(
  '/:id/logo/upload',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '9mb' }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (!Buffer.isBuffer(req.body)) {
      throw AppError.badRequest('Send the image file as the request body with its content type.');
    }
    const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    const data = await uploadGroupLogo(req.params.id ?? '', req.user.id, contentType, req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
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

// ---- Group Zoom events (leaders post, members RSVP) -------------------------

const eventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  date: z.string().datetime(),
  meetingUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  location: z.string().trim().max(160).optional(),
});
groupsRouter.post(
  '/:id/events',
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await createGroupEvent(req.params.id ?? '', req.user.id, {
      title: req.body.title,
      description: req.body.description,
      date: new Date(req.body.date),
      meetingUrl: req.body.meetingUrl || undefined,
      location: req.body.location,
    });
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

groupsRouter.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await listGroupEvents(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

groupsRouter.post(
  '/events/:eventId/rsvp',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await toggleEventRsvp(req.params.eventId ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

groupsRouter.delete(
  '/events/:eventId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await deleteGroupEvent(req.params.eventId ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ---- Group announcements (leaders post, members read) -----------------------

const announcementSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(4000),
});
groupsRouter.post(
  '/:id/announcements',
  validate(announcementSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await createAnnouncement(req.params.id ?? '', req.user.id, req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

groupsRouter.get(
  '/:id/announcements',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await listAnnouncements(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

groupsRouter.delete(
  '/announcements/:announcementId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await deleteAnnouncement(req.params.announcementId ?? '', req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
