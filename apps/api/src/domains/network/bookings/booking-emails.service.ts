import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { generateIcs } from '../../integrations/ics.service.js';
import { SYSTEM_ACCOUNT_EMAILS } from '../../../config/system-accounts.js';

/**
 * All booking notification emails in one place: booked, rescheduled, cancelled,
 * and reminder-before-call. Every one attaches an add-to-calendar (.ics) file
 * and CCs the platform admins so the team has visibility on every booking.
 *
 * Everything here is best-effort - a mail failure must never break the booking
 * action that triggered it. Callers already treat these as fire-and-forget.
 */

const BOOKING_TZ = 'America/New_York';

/** Format an instant as an Eastern wall-clock label (matches the rest of the app). */
function formatWhen(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: BOOKING_TZ,
    timeZoneName: 'short',
  });
}

const bookingSelect = {
  id: true,
  reason: true,
  notes: true,
  startsAt: true,
  endsAt: true,
  zoomUrl: true,
  host: { select: { email: true, firstName: true, lastName: true } },
  guest: { select: { email: true, firstName: true, lastName: true } },
} as const;

type BookingRow = {
  id: string;
  reason: string;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  zoomUrl: string | null;
  host: { email: string; firstName: string; lastName: string };
  guest: { email: string; firstName: string; lastName: string };
};

/** Real admin emails to CC on booking notifications (never the system accounts). */
export async function getBookingCcEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null, NOT: { email: { in: SYSTEM_ACCOUNT_EMAILS } } },
      select: { email: true },
    });
    return admins.map((a) => a.email).filter((e): e is string => Boolean(e));
  } catch {
    return [];
  }
}

/** CC list minus the two participants (so we never CC someone who's already `to`). */
function ccExcluding(cc: string[], ...exclude: string[]): string[] {
  const ex = new Set(exclude.map((e) => e.toLowerCase()));
  return cc.filter((e) => !ex.has(e.toLowerCase()));
}

function buildIcs(
  booking: BookingRow,
  perspective: 'host' | 'guest',
  method: 'REQUEST' | 'CANCEL',
  sequence: number,
): string {
  const peer = perspective === 'host' ? booking.guest : booking.host;
  const reasonLabel = booking.reason.replace(/_/g, ' ');
  return generateIcs({
    uid: booking.id,
    title: `Referral Nova call with ${peer.firstName} ${peer.lastName}`,
    description: `Reason: ${reasonLabel}${booking.notes ? `\n${booking.notes}` : ''}${booking.zoomUrl ? `\nZoom: ${booking.zoomUrl}` : ''}`,
    location: booking.zoomUrl ?? undefined,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    organizerEmail: booking.host.email,
    attendeeEmails: [booking.guest.email],
    method,
    sequence,
  });
}

async function loadBooking(bookingId: string): Promise<BookingRow | null> {
  return prisma.bookingCall.findUnique({ where: { id: bookingId }, select: bookingSelect });
}

/** Booked / confirmed - to both parties, CC admins, with .ics. */
export async function emailBookingConfirmed(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const cc = await getBookingCcEmails();
  const whenLabel = formatWhen(booking.startsAt);
  const reason = booking.reason.replace(/_/g, ' ');
  const seq = Math.floor(Date.now() / 1000);

  await sendEmail({
    to: booking.host.email,
    cc: ccExcluding(cc, booking.host.email, booking.guest.email),
    template: 'booking_confirmed',
    data: {
      withName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      whenLabel,
      reason,
      notes: booking.notes,
      zoomUrl: booking.zoomUrl,
    },
    attachments: [
      { filename: 'invite.ics', content: buildIcs(booking, 'host', 'REQUEST', seq), contentType: 'text/calendar' },
    ],
  }).catch(() => undefined);

  await sendEmail({
    to: booking.guest.email,
    cc: ccExcluding(cc, booking.host.email, booking.guest.email),
    template: 'booking_confirmed',
    data: {
      withName: `${booking.host.firstName} ${booking.host.lastName}`,
      whenLabel,
      reason,
      notes: booking.notes,
      zoomUrl: booking.zoomUrl,
    },
    attachments: [
      { filename: 'invite.ics', content: buildIcs(booking, 'guest', 'REQUEST', seq), contentType: 'text/calendar' },
    ],
  }).catch(() => undefined);
}

/** Rescheduled - to both parties, CC admins, with an updated .ics. */
export async function emailBookingRescheduled(bookingId: string, oldStartsAt: Date): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const cc = await getBookingCcEmails();
  const whenLabel = formatWhen(booking.startsAt);
  const oldWhenLabel = formatWhen(oldStartsAt);
  const seq = Math.floor(Date.now() / 1000);

  for (const side of ['host', 'guest'] as const) {
    const me = side === 'host' ? booking.host : booking.guest;
    const peer = side === 'host' ? booking.guest : booking.host;
    await sendEmail({
      to: me.email,
      cc: ccExcluding(cc, booking.host.email, booking.guest.email),
      template: 'booking_rescheduled',
      data: {
        firstName: me.firstName,
        withName: `${peer.firstName} ${peer.lastName}`,
        oldWhenLabel,
        whenLabel,
        zoomUrl: booking.zoomUrl,
      },
      attachments: [
        { filename: 'invite.ics', content: buildIcs(booking, side, 'REQUEST', seq), contentType: 'text/calendar' },
      ],
    }).catch(() => undefined);
  }
}

/** Reminder before the call - to both parties, CC admins, with .ics. */
export async function emailBookingReminder(bookingId: string, startsInLabel: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const cc = await getBookingCcEmails();
  const whenLabel = formatWhen(booking.startsAt);
  const seq = Math.floor(Date.now() / 1000);

  for (const side of ['host', 'guest'] as const) {
    const me = side === 'host' ? booking.host : booking.guest;
    const peer = side === 'host' ? booking.guest : booking.host;
    await sendEmail({
      to: me.email,
      cc: ccExcluding(cc, booking.host.email, booking.guest.email),
      template: 'booking_reminder',
      data: {
        firstName: me.firstName,
        withName: `${peer.firstName} ${peer.lastName}`,
        whenLabel,
        startsInLabel,
        zoomUrl: booking.zoomUrl,
      },
      attachments: [
        { filename: 'invite.ics', content: buildIcs(booking, side, 'REQUEST', seq), contentType: 'text/calendar' },
      ],
    }).catch(() => undefined);
  }
}

/**
 * Cancelled. Emails the party who did NOT cancel (plus CC admins) with a
 * cancellation .ics so it drops off their calendar. `canceledByHost` decides
 * who is notified.
 */
export async function emailBookingCanceled(
  bookingId: string,
  canceledByHost: boolean,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const cc = await getBookingCcEmails();
  const other = canceledByHost ? booking.guest : booking.host;
  const canceller = canceledByHost ? booking.host : booking.guest;
  const whenLabel = formatWhen(booking.startsAt);
  const seq = Math.floor(Date.now() / 1000);
  if (!other.email) return;
  await sendEmail({
    to: other.email,
    cc: ccExcluding(cc, other.email),
    template: 'booking_canceled',
    data: {
      firstName: other.firstName,
      withName: `${canceller.firstName} ${canceller.lastName}`.trim(),
      whenLabel,
    },
    attachments: [
      {
        filename: 'cancel.ics',
        content: buildIcs(booking, canceledByHost ? 'guest' : 'host', 'CANCEL', seq),
        contentType: 'text/calendar',
      },
    ],
  }).catch(() => undefined);
}
