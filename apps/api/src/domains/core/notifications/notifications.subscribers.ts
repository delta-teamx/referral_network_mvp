import type { EventBus } from '../events/EventBus.js';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { sendEmail } from './email.service.js';
// SMS removed - all notifications via email (SendGrid)
import { generateIcs } from '../../integrations/ics.service.js';
import {
  emailBookingConfirmed,
  emailBookingRescheduled,
} from '../../network/bookings/booking-emails.service.js';

/**
 * Notification subscribers - turn domain events into outbound emails. Kept
 * separate from the services that publish the events so the hot path stays
 * fast and the side-effects stay testable.
 *
 * Register via `registerNotificationSubscribers(eventBus)` at boot.
 */

const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';

export function registerNotificationSubscribers(eventBus: EventBus): void {
  eventBus.subscribe('business_invitation.sent', async ({ invitationId, recipientEmail }) => {
    const inv = await prisma.businessInvitation.findUnique({
      where: { id: invitationId },
      select: {
        token: true,
        message: true,
        sender: { select: { firstName: true, lastName: true } },
      },
    });
    if (!inv) return;
    await sendEmail({
      to: recipientEmail,
      template: 'invitation',
      data: {
        senderName: `${inv.sender.firstName} ${inv.sender.lastName}`,
        message: inv.message,
        inviteUrl: `${origin}/invite?token=${inv.token}`,
      },
    });
  });

  eventBus.subscribe('referral.sent', async ({ referralId }) => {
    const ref = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        clientName: true,
        notes: true,
        sender: { select: { firstName: true, lastName: true } },
        receiver: { select: { email: true } },
      },
    });
    if (!ref) return;
    await sendEmail({
      to: ref.receiver.email,
      template: 'referral_received',
      data: {
        senderName: `${ref.sender.firstName} ${ref.sender.lastName}`,
        clientName: ref.clientName ?? 'Unnamed client',
        notes: ref.notes ?? '',
        referralUrl: `${origin}/dashboard/referrals`,
      },
    });
    // Email notification already sent above
  });

  // NOTE: the `lead_received` email for consumer_lead.created is sent by
  // registerLeadSubscribers (leads.subscribers.ts) with fuller detail. It was
  // ALSO sent here, so every lead emailed the owner twice - removed to dedupe.

  // Booking confirmation emails to BOTH host and guest (+ admin CC, .ics).
  eventBus.subscribe('booking.created', async ({ bookingId }) => {
    await emailBookingConfirmed(bookingId);
  });

  // Reschedule emails to both parties (+ admin CC, updated .ics).
  eventBus.subscribe('booking.rescheduled', async ({ bookingId, oldStartsAt }) => {
    await emailBookingRescheduled(bookingId, new Date(oldStartsAt));
  });

  // Networking event registration confirmation
  eventBus.subscribe('networking_event.registered', async ({ eventId, userId }) => {
    const [event, user] = await Promise.all([
      prisma.networkingEvent.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          durationMin: true,
          zoomUrl: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true },
      }),
    ]);
    if (!event || !user) return;

    const endsAt = new Date(event.startsAt.getTime() + event.durationMin * 60_000);
    const whenLabel = event.startsAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const ics = generateIcs({
      uid: `event-${event.id}`,
      title: event.title,
      description: `${event.description ?? ''}\nZoom: ${event.zoomUrl ?? ''}`,
      location: event.zoomUrl ?? undefined,
      startsAt: event.startsAt,
      endsAt,
      attendeeEmails: [user.email],
    });

    await sendEmail({
      to: user.email,
      template: 'event_registered',
      data: {
        title: event.title,
        whenLabel,
        eventUrl: event.zoomUrl,
      },
      attachments: [{ filename: 'event.ics', content: ics, contentType: 'text/calendar' }],
    });
  });
}
