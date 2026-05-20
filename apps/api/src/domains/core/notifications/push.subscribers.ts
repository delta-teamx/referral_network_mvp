import type { eventBus as EventBus } from '../events/index.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { sendPushToUser } from './push.service.js';

/**
 * Push subscribers — turn intro lifecycle + booking events into browser
 * push notifications. These run alongside the existing email + SMS
 * subscribers; users opt into push channels independently by granting
 * Notification permission and subscribing the browser endpoint.
 */
export function registerPushSubscribers(bus: typeof EventBus): void {
  const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
  const root = origin.replace(/\/$/, '');

  bus.subscribe('intro.requested', async ({ introId, targetId }) => {
    const intro = await prisma.introduction.findUnique({
      where: { id: introId },
      select: {
        sender: { select: { firstName: true, lastName: true, memberProfile: { select: { businessName: true } } } },
      },
    });
    if (!intro) return;
    const senderName = `${intro.sender.firstName} ${intro.sender.lastName}`.trim();
    const business = intro.sender.memberProfile?.businessName;
    await sendPushToUser(targetId, {
      title: 'New intro request',
      body: business ? `${senderName} (${business}) wants to connect.` : `${senderName} wants to connect.`,
      url: `${root}/dashboard/matches?intro=${introId}`,
      tag: `intro-${introId}`,
    });
  });

  bus.subscribe('intro.accepted', async ({ introId, senderId, targetId }) => {
    const intro = await prisma.introduction.findUnique({
      where: { id: introId },
      select: {
        sender: { select: { firstName: true, lastName: true } },
        target: { select: { firstName: true, lastName: true } },
      },
    });
    if (!intro) return;
    await sendPushToUser(senderId, {
      title: 'Intro accepted',
      body: `${intro.target.firstName} accepted your intro. We're booking a Zoom call.`,
      url: `${root}/dashboard/matches`,
      tag: `intro-accepted-${introId}`,
    });
    await sendPushToUser(targetId, {
      title: 'Intro accepted',
      body: `Heads up — we're booking your call with ${intro.sender.firstName} now.`,
      url: `${root}/dashboard/bookings`,
      tag: `intro-accepted-${introId}-target`,
    });
  });

  bus.subscribe('booking.created', async ({ bookingId, hostId, guestId }) => {
    const booking = await prisma.bookingCall.findUnique({
      where: { id: bookingId },
      select: {
        startsAt: true,
        host: { select: { firstName: true } },
        guest: { select: { firstName: true } },
      },
    });
    if (!booking) return;
    const when = booking.startsAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    await sendPushToUser(hostId, {
      title: 'Call booked',
      body: `${booking.guest.firstName} · ${when}`,
      url: `${root}/dashboard/bookings`,
      tag: `booking-${bookingId}`,
    });
    await sendPushToUser(guestId, {
      title: 'Call booked',
      body: `${booking.host.firstName} · ${when}`,
      url: `${root}/dashboard/bookings`,
      tag: `booking-${bookingId}-guest`,
    });
  });
}
