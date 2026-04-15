import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, EventType } from '@refnet/shared';
import { EVENT_TYPES } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createLead,
  listConsumerLeadsForConsumer,
  listConsumerLeadsForOwner,
  updateLeadStatus,
} from './leads.service.js';

export const leadsRouter: Router = Router();

const createLeadSchema = z.object({
  listingId: z.string().uuid(),
  eventType: z.enum(EVENT_TYPES as readonly [EventType, ...EventType[]]),
  notes: z.string().max(1000).optional(),
});

leadsRouter.use(authenticate);

leadsRouter.post(
  '/',
  validate(createLeadSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const lead = await createLead({
      consumerId: req.user.id,
      listingId: req.body.listingId,
      eventType: req.body.eventType,
      notes: req.body.notes,
    });
    const body: ApiResponse<typeof lead> = { success: true, data: lead };
    res.status(201).json(body);
  }),
);

leadsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const leads = await listConsumerLeadsForConsumer(req.user.id);
    const body: ApiResponse<typeof leads> = { success: true, data: leads };
    res.json(body);
  }),
);

leadsRouter.get(
  '/received',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const status = typeof req.query.status === 'string' ? (req.query.status as string) : undefined;
    const leads = await listConsumerLeadsForOwner(req.user.id, { status });
    const body: ApiResponse<typeof leads> = { success: true, data: leads };
    res.json(body);
  }),
);

const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONTACTED', 'CONVERTED', 'EXPIRED']),
});

leadsRouter.patch(
  '/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await updateLeadStatus(req.params.id ?? '', req.user.id, req.body.status);
    const body: ApiResponse<typeof updated> = { success: true, data: updated };
    res.json(body);
  }),
);
