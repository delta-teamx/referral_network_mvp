import { prisma } from '../../../config/prisma.js';

/**
 * In-app notification service. Writes to the existing Notification model
 * and reads back for the bell-icon dropdown in the frontend nav.
 */

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
    },
  });
}

export async function listNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      data: true,
      isRead: true,
      createdAt: true,
    },
  });
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

/** Mark all unread notifications of the given types read — used when the user
 *  opens the tab those notifications point at (the red dot means "unseen"). */
export async function markReadByTypes(userId: string, types: string[]) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false, type: { in: types } },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * In-app Zoom reminders (no email): any confirmed call starting within the
 * next 60 minutes gets a one-time 'booking_reminder' notification. Called
 * lazily from the bell's polling endpoints, so reminders appear while the
 * user is anywhere in the app. Idempotent via the bookingId stored in data.
 */
export async function ensureBookingReminders(userId: string): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60_000);
  const bookings = await prisma.bookingCall.findMany({
    where: {
      status: 'confirmed',
      startsAt: { gte: now, lte: soon },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
    select: {
      id: true,
      startsAt: true,
      host: { select: { id: true, firstName: true, lastName: true } },
      guest: { select: { id: true, firstName: true, lastName: true } },
    },
    take: 10,
  });
  for (const b of bookings) {
    const already = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'booking_reminder',
        data: { path: ['bookingId'], equals: b.id },
      },
      select: { id: true },
    });
    if (already) continue;
    const peer = b.host.id === userId ? b.guest : b.host;
    const mins = Math.max(1, Math.round((b.startsAt.getTime() - now.getTime()) / 60_000));
    await createNotification({
      userId,
      type: 'booking_reminder',
      title: `⏰ Zoom call with ${peer.firstName} ${peer.lastName} in ${mins} min`,
      body: 'Open the Bookings tab to join when it starts.',
      data: { bookingId: b.id },
    });
  }
}
