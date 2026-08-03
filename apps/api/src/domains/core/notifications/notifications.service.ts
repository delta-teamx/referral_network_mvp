import { prisma } from '../../../config/prisma.js';
import { emitToUser } from '../../../realtime/io.js';

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
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
    },
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

  // Ring the bell in real time: push the new notification + fresh unread count
  // to every device this user has open. Best-effort - a realtime failure must
  // never fail the write, and offline users simply pick it up via the DB on
  // their next poll / page load.
  void unreadCount(input.userId)
    .then((count) => {
      emitToUser(input.userId, 'notification', { notification, unreadCount: count });
    })
    .catch(() => undefined);

  return notification;
}

export async function listNotifications(userId: string, limit = 20) {
  const rows = await prisma.notification.findMany({
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
  // Admin/ROUL direct messages are priority: they sit ABOVE everything else in
  // the inbox (before support and the rest), newest first. Unread ones outrank
  // read ones so a fresh admin note is always the first thing a member sees.
  return rows.sort((a, b) => {
    const rank = (n: (typeof rows)[number]) =>
      n.type === 'admin_message' ? (n.isRead ? 1 : 2) : 0;
    const diff = rank(b) - rank(a);
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

/** Mark all unread notifications of the given types read - used when the user
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
