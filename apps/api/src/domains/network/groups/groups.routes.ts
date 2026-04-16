import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createGroup,
  getGroupBySlug,
  joinGroup,
  leaveGroup,
  listGroups,
  listMyGroups,
} from './groups.service.js';

export const groupsRouter: Router = Router();

// Public discovery — no auth required
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

groupsRouter.get(
  '/by-slug/:slug',
  asyncHandler(async (req, res) => {
    const group = await getGroupBySlug(req.params.slug ?? '');
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
