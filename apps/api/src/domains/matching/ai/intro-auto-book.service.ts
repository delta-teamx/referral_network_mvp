import { eventBus } from '../../core/events/index.js';
import {
  createBooking,
  getAvailableSlots,
  type TimeSlot,
} from '../../network/bookings/bookings.service.js';

/**
 * Intro → meeting bridge. When an intro is accepted, we want a one-on-one
 * Zoom call on the books without making either member chase scheduling.
 *
 * Strategy: intersect both members' available slots, take the earliest mutual
 * 30-minute opening in the next 14 days, and create a confirmed BookingCall.
 * The existing booking.created event drives the Zoom link + ICS email to both
 * parties via the notifications subscriber — no new email plumbing.
 *
 * Fallback: if no mutual slot exists in the lookahead window (one side has no
 * Availability set, or schedules don't overlap), we publish
 * `intro.auto_booking_skipped` so a downstream handler can prompt the members
 * to coordinate manually. No booking is created — we never invent a Zoom for
 * a time neither party agreed to.
 */

export interface AutoBookResult {
  booked: boolean;
  bookingId?: string;
  startsAt?: Date;
  reason?: 'no_overlap' | 'no_availability' | 'error';
}

export async function autoBookFromIntro(input: {
  introId: string;
  hostUserId: string;
  guestUserId: string;
}): Promise<AutoBookResult> {
  const slot = await findFirstMutualSlot(input.hostUserId, input.guestUserId);
  if (!slot) {
    await eventBus.publish('intro.auto_booking_skipped', {
      introId: input.introId,
      hostUserId: input.hostUserId,
      guestUserId: input.guestUserId,
      reason: 'no_overlap',
    });
    return { booked: false, reason: 'no_overlap' };
  }

  try {
    const booking = await createBooking({
      hostUserId: input.hostUserId,
      guestUserId: input.guestUserId,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      reason: 'general_intro',
      notes: `Auto-booked from intro ${input.introId}`,
    });
    return { booked: true, bookingId: booking.id, startsAt: new Date(booking.startsAt) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[intro.auto-book] createBooking failed:', err);
    await eventBus.publish('intro.auto_booking_skipped', {
      introId: input.introId,
      hostUserId: input.hostUserId,
      guestUserId: input.guestUserId,
      reason: 'error',
    });
    return { booked: false, reason: 'error' };
  }
}

async function findFirstMutualSlot(
  userA: string,
  userB: string,
): Promise<TimeSlot | null> {
  const [aSlots, bSlots] = await Promise.all([
    getAvailableSlots(userA, { days: 14 }),
    getAvailableSlots(userB, { days: 14 }),
  ]);
  if (aSlots.length === 0 || bSlots.length === 0) return null;

  const bKeys = new Set(bSlots.map((s) => `${s.startsAt}|${s.endsAt}`));
  for (const slot of aSlots) {
    if (bKeys.has(`${slot.startsAt}|${slot.endsAt}`)) return slot;
  }
  return null;
}
