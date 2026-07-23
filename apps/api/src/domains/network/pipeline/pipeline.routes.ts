import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createCard,
  deleteCard,
  listPipeline,
  pipelineStats,
  updateCard,
} from './pipeline.service.js';

export const pipelineRouter: Router = Router();
pipelineRouter.use(authenticate);

pipelineRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const cards = await listPipeline(req.user.id);
    const body: ApiResponse<typeof cards> = { success: true, data: cards };
    res.json(body);
  }),
);

pipelineRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const stats = await pipelineStats(req.user.id);
    const body: ApiResponse<typeof stats> = { success: true, data: stats };
    res.json(body);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  stage: z.string().trim().max(40).optional(),
});
pipelineRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const card = await createCard(req.user.id, req.body);
    const body: ApiResponse<typeof card> = { success: true, data: card };
    res.status(201).json(body);
  }),
);

const patchSchema = z.object({
  stage: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});
pipelineRouter.patch(
  '/:id',
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const card = await updateCard(req.user.id, req.params.id ?? '', req.body);
    const body: ApiResponse<typeof card> = { success: true, data: card };
    res.json(body);
  }),
);

pipelineRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await deleteCard(req.user.id, req.params.id ?? '');
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);
