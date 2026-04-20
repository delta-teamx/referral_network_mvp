import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  BOOKING_REASONS,
  cancelBooking,
  createBooking,
  getAvailableSlots,
  listAvailability,
  listMyBookings,
  setAvailability,
} from './bookings.service.js';

export const bookingsRouter: Router = Router();

// Public: fetch someone's available slots (no login required to browse)
bookingsRouter.get(
  '/availability/:userId',
  asyncHandler(async (req, res) => {
    const days = req.query.days ? Number(req.query.days) : undefined;
    const slots = await getAvailableSlots(req.params.userId ?? '', { days });
    const body: ApiResponse<typeof slots> = { success: true, data: slots };
    res.json(body);
  }),
);

bookingsRouter.use(authenticate);

// My availability windows
bookingsRouter.get(
  '/my-availability',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const windows = await listAvailability(req.user.id);
    const body: ApiResponse<typeof windows> = { success: true, data: windows };
    res.json(body);
  }),
);

const availabilitySchema = z.object({
  windows: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startMin: z.number().int().min(0).max(1440),
      endMin: z.number().int().min(0).max(1440),
    }),
  ),
});

bookingsRouter.put(
  '/my-availability',
  validate(availabilitySchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await setAvailability(req.user.id, req.body.windows);
    const body: ApiResponse<typeof updated> = { success: true, data: updated };
    res.json(body);
  }),
);

// Create a booking
const createSchema = z.object({
  hostUserId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.enum(BOOKING_REASONS),
  notes: z.string().trim().max(500).optional(),
});

bookingsRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const booking = await createBooking({
      hostUserId: req.body.hostUserId,
      guestUserId: req.user.id,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
      reason: req.body.reason,
      notes: req.body.notes,
    });
    const body: ApiResponse<typeof booking> = { success: true, data: booking };
    res.status(201).json(body);
  }),
);

bookingsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const upcoming = req.query.upcoming === 'true';
    const bookings = await listMyBookings(req.user.id, { upcoming });
    const body: ApiResponse<typeof bookings> = { success: true, data: bookings };
    res.json(body);
  }),
);

bookingsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const booking = await cancelBooking(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof booking> = { success: true, data: booking };
    res.json(body);
  }),
);
