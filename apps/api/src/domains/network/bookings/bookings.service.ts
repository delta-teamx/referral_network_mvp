import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { createZoomMeeting } from '../../integrations/zoom.service.js';
import { createNotification } from '../../core/notifications/notifications.service.js';

/**
 * Booking & availability service.
 *
 * Availability is declared as weekly recurring windows (dayOfWeek + start/end
 * minutes). `getAvailableSlots` expands those windows into concrete 30-min
 * slots across the next N days, then subtracts existing confirmed bookings.
 *
 * Creating a booking reserves the slot AND provisions a Zoom meeting via
 * the Zoom service (demo URL when Zoom creds aren't configured).
 */

export const BOOKING_REASONS = [
  'referral',
  'partnership',
  'service_inquiry',
  'general_intro',
] as const;
export type BookingReason = (typeof BOOKING_REASONS)[number];

const SLOT_MINUTES = 30;
const DEFAULT_LOOKAHEAD_DAYS = 14;

export interface AvailabilityWindow {
  id?: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export async function setAvailability(
  userId: string,
  windows: AvailabilityWindow[],
): Promise<AvailabilityWindow[]> {
  for (const w of windows) {
    if (w.dayOfWeek < 0 || w.dayOfWeek > 6) throw AppError.badRequest('Invalid dayOfWeek');
    if (w.startMin < 0 || w.startMin > 1440) throw AppError.badRequest('Invalid startMin');
    if (w.endMin <= w.startMin || w.endMin > 1440) {
      throw AppError.badRequest('endMin must be after startMin and <= 1440');
    }
  }
  // Replace the whole set — simpler than diffing.
  await prisma.availability.deleteMany({ where: { userId } });
  if (windows.length > 0) {
    await prisma.availability.createMany({
      data: windows.map((w) => ({
        userId,
        dayOfWeek: w.dayOfWeek,
        startMin: w.startMin,
        endMin: w.endMin,
      })),
    });
  }
  return listAvailability(userId);
}

export async function listAvailability(userId: string): Promise<AvailabilityWindow[]> {
  const rows = await prisma.availability.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startMin: r.startMin,
    endMin: r.endMin,
  }));
}

export interface TimeSlot {
  startsAt: string; // ISO
  endsAt: string;
}

export async function getAvailableSlots(
  hostUserId: string,
  opts: { days?: number; from?: Date } = {},
): Promise<TimeSlot[]> {
  const days = Math.min(opts.days ?? DEFAULT_LOOKAHEAD_DAYS, 60);
  const from = opts.from ?? new Date();
  from.setMinutes(Math.ceil(from.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES, 0, 0);

  const windows = await prisma.availability.findMany({
    where: { userId: hostUserId },
  });
  if (windows.length === 0) return [];

  const existing = await prisma.bookingCall.findMany({
    where: {
      hostId: hostUserId,
      status: { in: ['pending', 'confirmed'] },
      startsAt: { gte: from, lte: new Date(from.getTime() + days * 86400_000) },
    },
    select: { startsAt: true, endsAt: true },
  });
  const busy = existing.map((b) => [b.startsAt.getTime(), b.endsAt.getTime()] as [number, number]);

  const slots: TimeSlot[] = [];
  for (let d = 0; d < days; d++) {
    const dayStart = new Date(from);
    dayStart.setDate(dayStart.getDate() + d);
    dayStart.setHours(0, 0, 0, 0);
    const dow = dayStart.getDay();
    const todaysWindows = windows.filter((w) => w.dayOfWeek === dow);

    for (const w of todaysWindows) {
      for (let m = w.startMin; m + SLOT_MINUTES <= w.endMin; m += SLOT_MINUTES) {
        const start = new Date(dayStart.getTime() + m * 60_000);
        if (start < from) continue; // past slot on today
        const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
        const overlap = busy.some(
          ([bs, be]) => !(end.getTime() <= bs || start.getTime() >= be),
        );
        if (!overlap) {
          slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
        }
      }
    }
  }
  return slots.slice(0, 200);
}

export interface CreateBookingInput {
  hostUserId: string;
  guestUserId: string;
  startsAt: Date;
  endsAt: Date;
  reason: BookingReason;
  notes?: string;
}

export async function createBooking(input: CreateBookingInput) {
  if (input.hostUserId === input.guestUserId) {
    throw AppError.badRequest("You can't book a call with yourself.");
  }
  if (input.endsAt <= input.startsAt) {
    throw AppError.badRequest('endsAt must be after startsAt');
  }
  const maxDurationMs = 8 * 60 * 60 * 1000;
  if (input.endsAt.getTime() - input.startsAt.getTime() > maxDurationMs) {
    throw AppError.badRequest('Booking duration cannot exceed 8 hours');
  }
  if (!BOOKING_REASONS.includes(input.reason)) {
    throw AppError.badRequest('Invalid booking reason');
  }

  const [host, guest] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.hostUserId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.user.findFirst({
      where: { id: input.guestUserId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);
  if (!host) throw AppError.notFound('Host not found');
  if (!guest) throw AppError.notFound('Guest not found');

  // Conflict check — a pending request holds the slot too.
  const conflict = await prisma.bookingCall.findFirst({
    where: {
      hostId: input.hostUserId,
      status: { in: ['pending', 'confirmed'] },
      OR: [
        {
          startsAt: { lt: input.endsAt },
          endsAt: { gt: input.startsAt },
        },
      ],
    },
    select: { id: true },
  });
  if (conflict) throw AppError.conflict('That time slot is no longer available.');

  // A booking is a REQUEST: the host must accept before it's confirmed and a
  // meeting link is provisioned — nobody gets a call on their calendar without
  // prior notice.
  const booking = await prisma.bookingCall.create({
    data: {
      hostId: input.hostUserId,
      guestId: input.guestUserId,
      reason: input.reason,
      notes: input.notes?.trim() || null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: 'pending',
    },
    select: bookingSelect,
  });

  // Alert the host in-app (best-effort).
  void createNotification({
    userId: input.hostUserId,
    type: 'booking_request',
    title: 'New call request',
    body: `${guest.firstName} ${guest.lastName} requested a call on ${input.startsAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Accept or decline in Bookings.`,
    data: { bookingId: booking.id },
  }).catch(() => undefined);

  return booking;
}

/**
 * Host responds to a pending booking request. Accept provisions the Zoom
 * meeting, confirms the booking and emails both parties; decline releases
 * the slot. Only the host may respond.
 */
export async function respondToBooking(
  bookingId: string,
  hostUserId: string,
  action: 'accept' | 'decline',
) {
  const booking = await prisma.bookingCall.findFirst({
    where: { id: bookingId, hostId: hostUserId, status: 'pending' },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      reason: true,
      guestId: true,
      host: { select: { firstName: true, lastName: true, email: true } },
      guest: { select: { firstName: true, lastName: true } },
    },
  });
  if (!booking) throw AppError.notFound('Pending booking request not found');

  if (action === 'decline') {
    const updated = await prisma.bookingCall.update({
      where: { id: booking.id },
      data: { status: 'declined', canceledAt: new Date() },
      select: bookingSelect,
    });
    void createNotification({
      userId: booking.guestId,
      type: 'booking_declined',
      title: 'Call request declined',
      body: `${booking.host.firstName} ${booking.host.lastName} can't make that time. Pick another slot from their profile.`,
      data: { bookingId: booking.id },
    }).catch(() => undefined);
    return updated;
  }

  const durationMin = Math.round(
    (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
  );
  const zoom = await createZoomMeeting({
    topic: `${booking.guest.firstName} ${booking.guest.lastName} ↔ ${booking.host.firstName} ${booking.host.lastName} (${booking.reason.replace('_', ' ')})`,
    startsAt: booking.startsAt,
    durationMin,
    hostEmail: booking.host.email,
  });

  const updated = await prisma.bookingCall.update({
    where: { id: booking.id },
    data: { status: 'confirmed', zoomUrl: zoom.joinUrl, zoomMeetingId: zoom.meetingId },
    select: bookingSelect,
  });

  // Confirmation emails (with .ics) to both parties via the existing subscriber.
  await eventBus.publish('booking.created', {
    bookingId: booking.id,
    hostId: hostUserId,
    guestId: booking.guestId,
  });

  void createNotification({
    userId: booking.guestId,
    type: 'booking_confirmed',
    title: 'Call confirmed 🎉',
    body: `${booking.host.firstName} ${booking.host.lastName} accepted your call request — the Zoom link is in your Bookings tab.`,
    data: { bookingId: booking.id },
  }).catch(() => undefined);

  return updated;
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.bookingCall.findFirst({
    where: {
      id: bookingId,
      OR: [{ hostId: userId }, { guestId: userId }],
      status: { in: ['pending', 'confirmed'] },
    },
    select: { id: true },
  });
  if (!booking) throw AppError.notFound('Booking not found');
  const updated = await prisma.bookingCall.update({
    where: { id: booking.id },
    data: { status: 'canceled', canceledAt: new Date() },
    select: bookingSelect,
  });
  await eventBus.publish('booking.canceled', { bookingId: updated.id });
  return updated;
}

export async function listMyBookings(
  userId: string,
  opts: { upcoming?: boolean } = {},
) {
  return prisma.bookingCall.findMany({
    where: {
      OR: [{ hostId: userId }, { guestId: userId }],
      ...(opts.upcoming
        ? { startsAt: { gte: new Date() }, status: { in: ['pending', 'confirmed'] } }
        : {}),
    },
    orderBy: { startsAt: 'asc' },
    take: 100,
    select: bookingSelect,
  });
}

const bookingSelect = {
  id: true,
  reason: true,
  notes: true,
  startsAt: true,
  endsAt: true,
  status: true,
  zoomUrl: true,
  zoomMeetingId: true,
  createdAt: true,
  host: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      memberProfile: { select: { businessName: true, industry: true } },
    },
  },
  guest: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      memberProfile: { select: { businessName: true, industry: true } },
    },
  },
} as const;
