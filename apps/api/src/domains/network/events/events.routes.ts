import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  cancelEvent, createEvent, getEvent, inviteUsersToEvent, listAllEvents,
  listMyRegistrations, listUpcomingEvents, registerForEvent, unregister, updateEvent,
} from './events.service.js';

export const eventsRouter: Router = Router();

eventsRouter.get('/upcoming', asyncHandler(async (_req, res) => {
  const events = await listUpcomingEvents();
  res.json({ success: true, data: events });
}));

eventsRouter.get('/:id', asyncHandler(async (req, res) => {
  const event = await getEvent(req.params.id ?? '');
  res.json({ success: true, data: event });
}));

eventsRouter.use(authenticate);

eventsRouter.post('/:id/register', asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const result = await registerForEvent(req.params.id ?? '', req.user.id);
  res.json({ success: true, data: result });
}));

eventsRouter.post('/:id/unregister', asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const result = await unregister(req.params.id ?? '', req.user.id);
  res.json({ success: true, data: result });
}));

eventsRouter.get('/me/registrations', asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const events = await listMyRegistrations(req.user.id);
  res.json({ success: true, data: events });
}));

eventsRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin only'));
  return next();
});

eventsRouter.get('/admin/all', asyncHandler(async (_req, res) => {
  const events = await listAllEvents();
  res.json({ success: true, data: events });
}));

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.string().datetime(),
  durationMin: z.number().int().min(15).max(480).optional(),
  maxAttendees: z.number().int().min(2).max(1000).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().trim().max(120).optional(),
});

eventsRouter.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  if (!req.user) throw AppError.unauthorized();
  const event = await createEvent({
    title: req.body.title, description: req.body.description,
    startsAt: new Date(req.body.startsAt), durationMin: req.body.durationMin,
    maxAttendees: req.body.maxAttendees, isRecurring: req.body.isRecurring,
    recurrenceRule: req.body.recurrenceRule, createdById: req.user.id,
  });
  res.status(201).json({ success: true, data: event });
}));

const updateSchema = createSchema.partial().extend({
  status: z.enum(['scheduled', 'live', 'completed', 'canceled']).optional(),
});

eventsRouter.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.startsAt) patch.startsAt = new Date(patch.startsAt);
  const event = await updateEvent(req.params.id ?? '', patch);
  res.json({ success: true, data: event });
}));

eventsRouter.post('/:id/cancel', asyncHandler(async (req, res) => {
  const event = await cancelEvent(req.params.id ?? '');
  res.json({ success: true, data: event });
}));

const inviteSchema = z.object({ userIds: z.array(z.string()).min(1).max(100) });

eventsRouter.post('/:id/invite', validate(inviteSchema), asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
  const result = await inviteUsersToEvent(req.params.id ?? '', req.body.userIds);
  res.json({ success: true, data: result });
}));
