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
