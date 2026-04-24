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
  featureListing,
  impersonateUser,
  listAllGroups,
  listAllListings,
  listAllUsers,
  listPendingListings,
  rejectListing,
  setUserRole,
  suspendUser,
} from './admin.service.js';

export const adminRouter: Router = Router();
adminRouter.use(authenticate);

// Coarse-grained gate — the RBAC permission middleware can lock specific
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

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 25));
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
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 25));
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
