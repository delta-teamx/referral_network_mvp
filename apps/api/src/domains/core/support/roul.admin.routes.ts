import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  deleteKnowledgeChunk,
  getPrompt,
  listEscalations,
  listKnowledgeChunks,
  resolveEscalation,
  resyncCuratedKnowledge,
  setEscalationStatus,
  updatePrompt,
  upsertKnowledgeChunk,
} from './roul.admin.service.js';

/** ROUL admin console API. All routes require ADMIN. */
export const roulAdminRouter: Router = Router();

roulAdminRouter.use(authenticate);
roulAdminRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin role required'));
  next();
});

// ── Escalation log ───────────────────────────────────────────────────────────

roulAdminRouter.get(
  '/escalations',
  asyncHandler(async (_req, res) => {
    const data = await listEscalations();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

roulAdminRouter.post(
  '/escalations/:id/resolve',
  asyncHandler(async (req, res) => {
    const data = await resolveEscalation(req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const statusSchema = z.object({ status: z.enum(['open', 'fixed', 'dismissed']) });
roulAdminRouter.patch(
  '/escalations/:id',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const data = await setEscalationStatus(req.params.id ?? '', req.body.status);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ── Knowledge (edit without deploy) ──────────────────────────────────────────

roulAdminRouter.get(
  '/knowledge',
  asyncHandler(async (_req, res) => {
    const data = await listKnowledgeChunks();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const knowledgeSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().max(200).optional().default(''),
  content: z.string().trim().min(1).max(8000),
});

roulAdminRouter.post(
  '/knowledge',
  validate(knowledgeSchema),
  asyncHandler(async (req, res) => {
    const data = await upsertKnowledgeChunk(req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.status(201).json(body);
  }),
);

roulAdminRouter.delete(
  '/knowledge/:id',
  asyncHandler(async (req, res) => {
    const data = await deleteKnowledgeChunk(req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

roulAdminRouter.post(
  '/knowledge/resync',
  asyncHandler(async (_req, res) => {
    const data = await resyncCuratedKnowledge();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ── System prompt (edit without deploy) ──────────────────────────────────────

roulAdminRouter.get(
  '/prompt',
  asyncHandler(async (_req, res) => {
    const data = await getPrompt();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const promptSchema = z.object({ text: z.string().max(8000).nullable() });

roulAdminRouter.put(
  '/prompt',
  validate(promptSchema),
  asyncHandler(async (req, res) => {
    const data = await updatePrompt(req.body.text);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
