import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  cancelEvent,
  createEvent,
  getEvent,
  listAllEvents,
  listMyRegistrations,
  listUpcomingEvents,
  registerForEvent,
  unregister,
  updateEvent,
} from './events.service.js';

export const eventsRouter: Router = Router();

// Public: discover events
eventsRouter.get(
  '/upcoming',
  asyncHandler(async (_req, res) => {
    const events = await listUpcomingEvents();
    const body: ApiResponse<typeof events> = { success: true, data: events };
    res.json(body);
  }),
);

eventsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await getEvent(req.params.id ?? '');
    const body: ApiResponse<typeof event> = { success: true, data: event };
    res.json(body);
  }),
);

eventsRouter.use(authenticate);

// Member: register + list mine
eventsRouter.post(
  '/:id/register',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await registerForEvent(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

eventsRouter.post(
  '/:id/unregister',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await unregister(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

eventsRouter.get(
  '/me/registrations',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const events = await listMyRegistrations(req.user.id);
    const body: ApiResponse<typeof events> = { success: true, data: events };
    res.json(body);
  }),
);

// Admin only
eventsRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin only'));
  return next();
});

eventsRouter.get(
  '/admin/all',
  asyncHandler(async (_req, res) => {
    const events = await listAllEvents();
    const body: ApiResponse<typeof events> = { success: true, data: events };
    res.json(body);
  }),
);

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(480).optional(),
  maxAttendees: z.number().int().min(2).max(1000).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().trim().max(120).optional(),
});

eventsRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const event = await createEvent({
      title: req.body.title,
      description: req.body.description,
      startsAt: new Date(req.body.startsAt),
      durationMin: req.body.durationMin,
      maxAttendees: req.body.maxAttendees,
      isRecurring: req.body.isRecurring,
      recurrenceRule: req.body.recurrenceRule,
      createdById: req.user.id,
    });
    const body: ApiResponse<typeof event> = { success: true, data: event };
    res.status(201).json(body);
  }),
);

const updateSchema = createSchema.partial().extend({
  status: z.enum(['scheduled', 'live', 'completed', 'canceled']).optional(),
});

eventsRouter.patch(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const patch = { ...req.body };
    if (patch.startsAt) patch.startsAt = new Date(patch.startsAt);
    const event = await updateEvent(req.params.id ?? '', patch);
    const body: ApiResponse<typeof event> = { success: true, data: event };
    res.json(body);
  }),
);

eventsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const event = await cancelEvent(req.params.id ?? '');
    const body: ApiResponse<typeof event> = { success: true, data: event };
    res.json(body);
  }),
);
