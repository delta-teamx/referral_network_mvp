import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { createZoomMeeting } from '../../integrations/zoom.service.js';
import { createNotification } from '../../core/notifications/notifications.service.js';
import { sendEmail } from '../../core/notifications/email.service.js';

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

// Availability windows are declared in Eastern time. We expand them in this
// zone so a host's "9-5" means 9-5 Eastern regardless of the server's clock,
// and DST is handled correctly (offset is resolved per-instant below).
const BOOKING_TZ = 'America/New_York';

/** The wall-clock parts (in `tz`) of a given UTC instant. */
function zonedParts(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(p.year),
    month: Number(p.month), // 1-12
    day: Number(p.day),
    dow: dowMap[p.weekday ?? 'Sun'] ?? 0,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Convert a wall-clock time in `tz` (given y/m/d + minutes-from-midnight) to the UTC instant. */
function zonedWallClockToUtc(
  year: number,
  month1: number,
  day: number,
  minutes: number,
  tz: string,
): Date {
  // First guess: treat the wall clock as if it were UTC.
  const guess = new Date(Date.UTC(year, month1 - 1, day, 0, 0, 0) + minutes * 60_000);
  // Measure the zone's offset at that instant and correct for it (one pass
  // resolves all but the ~1hr DST-transition ambiguity, which is acceptable).
  const parts = zonedParts(guess, tz);
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0) + parts.minutes * 60_000;
  const offset = wallAsUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export interface AvailabilityWindow {
  id?: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

// Default availability applied to any member who hasn't set their own, so
// every member is bookable out of the box. Monday-Friday, 9:00am-5:00pm
// Eastern. Members can override it any time from the availability editor.
export const DEFAULT_AVAILABILITY: AvailabilityWindow[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startMin: 9 * 60,
  endMin: 17 * 60,
}));

/** A member's declared windows, or the M-F 9-5 default when they have none. */
async function getEffectiveWindows(
  userId: string,
): Promise<Array<{ dayOfWeek: number; startMin: number; endMin: number }>> {
  const rows = await prisma.availability.findMany({ where: { userId } });
  if (rows.length > 0) {
    return rows.map((r) => ({ dayOfWeek: r.dayOfWeek, startMin: r.startMin, endMin: r.endMin }));
  }
  return DEFAULT_AVAILABILITY.map((w) => ({
    dayOfWeek: w.dayOfWeek,
    startMin: w.startMin,
    endMin: w.endMin,
  }));
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
  // Replace the whole set - simpler than diffing.
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
  // Show the M-F 9-5 default to members who haven't set their own, so the
  // editor is pre-filled and they can adjust it rather than start from blank.
  if (rows.length === 0) {
    return DEFAULT_AVAILABILITY.map((w) => ({ ...w }));
  }
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
  // Clone so we never mutate the caller's Date (opts.from).
  const from = new Date(opts.from ?? new Date());
  from.setMinutes(Math.ceil(from.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES, 0, 0);

  // Falls back to the M-F 9-5 default when the host hasn't set availability,
  // so every member is bookable out of the box.
  const windows = await getEffectiveWindows(hostUserId);

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
    // The Eastern calendar date d days out from `from`.
    const dayParts = zonedParts(new Date(from.getTime() + d * 86400_000), BOOKING_TZ);
    const todaysWindows = windows.filter((w) => w.dayOfWeek === dayParts.dow);

    for (const w of todaysWindows) {
      for (let m = w.startMin; m + SLOT_MINUTES <= w.endMin; m += SLOT_MINUTES) {
        // Convert the Eastern wall-clock slot time to the real UTC instant.
        const start = zonedWallClockToUtc(dayParts.year, dayParts.month, dayParts.day, m, BOOKING_TZ);
        if (start < from) continue; // past slot
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

/**
 * True when [startsAt, endsAt) falls entirely inside one of the host's declared
 * Eastern availability windows. Used to reject bookings for arbitrary times.
 */
async function isWithinAvailability(hostUserId: string, startsAt: Date, endsAt: Date): Promise<boolean> {
  // Same default as slot generation: no declared windows => M-F 9-5.
  const windows = await getEffectiveWindows(hostUserId);
  const s = zonedParts(startsAt, BOOKING_TZ);
  const e = zonedParts(endsAt, BOOKING_TZ);
  // Reject slots that cross a day boundary in Eastern time.
  if (s.year !== e.year || s.month !== e.month || s.day !== e.day) {
    // endsAt at exactly midnight is fine if it equals the window end.
    if (!(e.minutes === 0)) return false;
  }
  const endMinutes = e.minutes === 0 && (s.day !== e.day) ? 24 * 60 : e.minutes;
  return windows.some(
    (w) => w.dayOfWeek === s.dow && s.minutes >= w.startMin && endMinutes <= w.endMin,
  );
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
  // Reject bookings in the past (with a small grace for clock skew).
  if (input.startsAt.getTime() < Date.now() - 60_000) {
    throw AppError.badRequest('That time is in the past. Please pick an upcoming slot.');
  }
  // Reject times outside the host's declared availability windows.
  if (!(await isWithinAvailability(input.hostUserId, input.startsAt, input.endsAt))) {
    throw AppError.badRequest("That time isn't within the host's available hours.");
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

  // Conflict check - a pending request holds the slot too.
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
  // meeting link is provisioned - nobody gets a call on their calendar without
  // prior notice. The DB exclusion constraint (BookingCall_no_overlap) is the
  // real guard against the check-then-insert race - if two requests land at
  // once, one insert violates it and we surface a clean conflict.
  let booking;
  try {
    booking = await prisma.bookingCall.create({
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
  } catch (err) {
    const msg = String((err as { message?: string })?.message ?? err);
    if (msg.includes('BookingCall_no_overlap') || msg.includes('23P01')) {
      throw AppError.conflict('That time slot is no longer available.');
    }
    throw err;
  }

  const whenLabel = input.startsAt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  // Alert the host in-app (best-effort).
  void createNotification({
    userId: input.hostUserId,
    type: 'booking_request',
    title: 'New call request',
    body: `${guest.firstName} ${guest.lastName} requested a call on ${whenLabel}. Accept or decline in Bookings.`,
    data: { bookingId: booking.id },
  }).catch(() => undefined);

  // Email the host so they accept faster (a request that sits unseen is a lost
  // meeting). Best-effort.
  if (host.email) {
    void sendEmail({
      to: host.email,
      template: 'booking_request',
      data: {
        firstName: host.firstName,
        fromName: `${guest.firstName} ${guest.lastName}`.trim(),
        whenLabel,
      },
    }).catch(() => undefined);
  }

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
    body: `${booking.host.firstName} ${booking.host.lastName} accepted your call request - the Zoom link is in your Bookings tab.`,
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
    select: {
      id: true,
      hostId: true,
      guestId: true,
      startsAt: true,
      host: { select: { firstName: true, lastName: true, email: true } },
      guest: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!booking) throw AppError.notFound('Booking not found');
  const updated = await prisma.bookingCall.update({
    where: { id: booking.id },
    data: { status: 'canceled', canceledAt: new Date() },
    select: bookingSelect,
  });
  await eventBus.publish('booking.canceled', { bookingId: updated.id });

  // Notify the OTHER party (not whoever cancelled) in-app + by email.
  const canceledByHost = userId === booking.hostId;
  const other = canceledByHost ? booking.guest : booking.host;
  const canceller = canceledByHost ? booking.host : booking.guest;
  const otherId = canceledByHost ? booking.guestId : booking.hostId;
  const whenLabel = booking.startsAt.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  void createNotification({
    userId: otherId,
    type: 'booking_declined',
    title: 'Call canceled',
    body: `${canceller.firstName} ${canceller.lastName} canceled your call on ${whenLabel}. You can rebook anytime.`,
    data: { bookingId: booking.id },
  }).catch(() => undefined);
  if (other.email) {
    void sendEmail({
      to: other.email,
      template: 'booking_canceled',
      data: {
        firstName: other.firstName,
        withName: `${canceller.firstName} ${canceller.lastName}`.trim(),
        whenLabel,
      },
    }).catch(() => undefined);
  }
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

/** Rate a finished (or confirmed) call 1-5. Host and guest each rate once;
 *  the rating you RECEIVE is what shows on your analytics rating card. */
export async function rateBooking(bookingId: string, userId: string, rating: number) {
  const booking = await prisma.bookingCall.findFirst({
    where: {
      id: bookingId,
      OR: [{ hostId: userId }, { guestId: userId }],
      status: { in: ['confirmed', 'completed'] },
    },
    select: { id: true, hostId: true },
  });
  if (!booking) throw AppError.notFound('Booking not found or not ratable yet');
  const isHost = booking.hostId === userId;
  return prisma.bookingCall.update({
    where: { id: booking.id },
    data: isHost ? { hostRating: rating } : { guestRating: rating },
    select: { id: true, hostRating: true, guestRating: true, status: true },
  });
}
