import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import {
  adminOverview,
  approveListing,
  archiveGroup,
  hardDeleteGroup,
  featureListing,
  impersonateUser,
  listAllGroups,
  listAllListings,
  listAllUsers,
  listPendingListings,
  rejectListing,
  sendAdminMessage,
  setUserRole,
  setUserTier,
  hardDeleteUser,
  suspendUser,
} from './admin.service.js';
import {
  adminReplyAsRoul,
  getOfficialThread,
  listOfficialConversations,
} from '../network/messaging/messaging.service.js';

export const adminRouter: Router = Router();
adminRouter.use(authenticate);

// Coarse-grained gate - the RBAC permission middleware can lock specific
// endpoints down further; this stops any non-ADMIN from probing the router.
adminRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin role required'));
  return next();
});

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const data = await adminOverview();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Run (or dry-run) the re-engagement sweep on demand. dryRun returns who WOULD
// be emailed without sending; omit it to send for real.
const reengageSchema = z.object({ dryRun: z.boolean().optional() });
adminRouter.post(
  '/reengagement',
  validate(reengageSchema),
  asyncHandler(async (req, res) => {
    const { runReengagementSweep } = await import('../core/notifications/reengagement.service.js');
    const result = await runReengagementSweep({ dryRun: req.body.dryRun === true });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Run (or dry-run) the 24h profile-completion reminder sweep on demand.
adminRouter.post(
  '/profile-reminders',
  validate(reengageSchema),
  asyncHandler(async (req, res) => {
    const { runProfileCompletionReminders } = await import(
      '../core/notifications/reengagement.service.js'
    );
    const result = await runProfileCompletionReminders({ dryRun: req.body.dryRun === true });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Send one of every email template (branded redesign) to an address for review.
const previewSchema = z.object({ to: z.string().email() });
adminRouter.post(
  '/email-previews',
  validate(previewSchema),
  asyncHandler(async (req, res) => {
    const { sendTemplatePreviews } = await import('../core/notifications/email.service.js');
    const sent = await sendTemplatePreviews(req.body.to);
    const body: ApiResponse<{ sent: string[] }> = { success: true, data: { sent } };
    res.json(body);
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listAllUsers(page, limit, q);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const roleSchema = z.object({
  role: z.enum(['CONSUMER', 'BUSINESS_OWNER', 'GROUP_LEADER', 'CITY_CAPTAIN', 'ADMIN']),
});
adminRouter.post(
  '/users/:id/role',
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You cannot change your own role.');
    }
    const data = await setUserRole(req.user.id, req.params.id ?? '', req.body.role);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const tierSchema = z.object({ tier: z.enum(['FREE', 'PRO', 'PREMIUM']) });
adminRouter.post(
  '/users/:id/tier',
  validate(tierSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await setUserTier(req.user.id, req.params.id ?? '', req.body.tier);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Direct admin -> member message (ROUL note in their inbox). For reminders and
// direct support; never added to pipelines. Reaches every member (all plans).
const adminMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message is required').max(2000),
  title: z.string().trim().max(120).optional(),
});
adminRouter.post(
  '/users/:id/message',
  validate(adminMessageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await sendAdminMessage(
      req.user.id,
      req.params.id ?? '',
      req.body.text,
      req.body.title,
    );
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ── ROUL Support: admin-facing member message threads (Messages tab) ──────────
adminRouter.get(
  '/roul-threads',
  asyncHandler(async (_req, res) => {
    const data = await listOfficialConversations();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/roul-threads/:id',
  asyncHandler(async (req, res) => {
    const data = await getOfficialThread(req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const roulReplySchema = z.object({ text: z.string().trim().min(1).max(5000) });
adminRouter.post(
  '/roul-threads/:id/reply',
  validate(roulReplySchema),
  asyncHandler(async (req, res) => {
    const data = await adminReplyAsRoul(req.params.id ?? '', req.body.text);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const suspendSchema = z.object({ reason: z.string().trim().min(3).max(500) });
adminRouter.post(
  '/users/:id/suspend',
  validate(suspendSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You cannot suspend your own account.');
    }
    const data = await suspendUser(req.user.id, req.params.id ?? '', req.body.reason);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Irreversible: wipe a (non-admin) user and all their data. Test-data cleanup.
adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await hardDeleteUser(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/users/:id/impersonate',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You are already logged in as this user.');
    }
    const data = await impersonateUser(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/listings/pending',
  asyncHandler(async (_req, res) => {
    const data = await listPendingListings();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/listings',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listAllListings(page, limit, q);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/listings/:id/approve',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await approveListing(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
adminRouter.post(
  '/listings/:id/reject',
  validate(rejectSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await rejectListing(req.user.id, req.params.id ?? '', req.body.reason);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const featureSchema = z.object({ featured: z.boolean() });
adminRouter.post(
  '/listings/:id/feature',
  validate(featureSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await featureListing(req.user.id, req.params.id ?? '', req.body.featured);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const data = await listAllGroups();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/groups/:id/archive',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await archiveGroup(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Irreversible: wipe a group with its members, chat and events (test cleanup).
adminRouter.delete(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await hardDeleteGroup(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
