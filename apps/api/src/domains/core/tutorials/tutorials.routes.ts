import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createTutorial,
  deleteTutorial,
  getFeaturedVideo,
  listAllTutorials,
  listTutorialVideos,
  updateTutorial,
} from './tutorials.service.js';

// ---------------------------------------------------------------------------
// Public + member routes
// ---------------------------------------------------------------------------

export const tutorialsRouter: Router = Router();

/** Public: the featured homepage video (no auth - it's a marketing page). */
tutorialsRouter.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const video = await getFeaturedVideo();
    const body: ApiResponse<typeof video> = { success: true, data: video };
    res.json(body);
  }),
);

/** Member: all videos for the dashboard Tutorials tab. */
tutorialsRouter.get(
  '/',
  authenticate,
  asyncHandler(async (_req, res) => {
    const videos = await listTutorialVideos();
    const body: ApiResponse<typeof videos> = { success: true, data: videos };
    res.json(body);
  }),
);

// ---------------------------------------------------------------------------
// Admin routes (mounted separately at /api/v1/admin/tutorials)
// ---------------------------------------------------------------------------

export const adminTutorialsRouter: Router = Router();

adminTutorialsRouter.use(authenticate);
adminTutorialsRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin role required'));
  next();
});

const upsertSchema = z.object({
  youtubeUrl: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  showOnHomepage: z.boolean().optional(),
  showInTutorials: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const patchSchema = upsertSchema.partial();

adminTutorialsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const videos = await listAllTutorials();
    const body: ApiResponse<typeof videos> = { success: true, data: videos };
    res.json(body);
  }),
);

adminTutorialsRouter.post(
  '/',
  validate(upsertSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const video = await createTutorial(req.body, req.user.id);
    const body: ApiResponse<typeof video> = { success: true, data: video };
    res.status(201).json(body);
  }),
);

adminTutorialsRouter.patch(
  '/:id',
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const video = await updateTutorial(req.params.id ?? '', req.body);
    const body: ApiResponse<typeof video> = { success: true, data: video };
    res.json(body);
  }),
);

adminTutorialsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await deleteTutorial(req.params.id ?? '');
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);
