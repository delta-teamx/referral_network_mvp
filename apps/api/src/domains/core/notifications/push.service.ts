import webpush from 'web-push';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';

/**
 * Web Push (Feature 6). Provider-style abstraction mirroring email + sms.
 *
 * Configured lazily — if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are unset
 * sendPushToUser is a no-op (logs to console in dev), matching the
 * SMS pattern. Subscriptions can still be persisted client-side; they
 * just don't fire.
 *
 * Idempotency: PushSubscription has @@unique([userId, endpoint]) so
 * upserts are safe.
 */

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function isPushEnabled(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { userId_endpoint: { userId: input.userId, endpoint: input.endpoint } },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription
    .delete({ where: { userId_endpoint: { userId, endpoint } } })
    .catch(() => undefined);
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{
  delivered: number;
  expired: number;
  failed: number;
}> {
  const stats = { delivered: 0, expired: 0, failed: 0 };
  if (!ensureConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`[push] (disabled) would send to ${userId}:`, payload);
    return stats;
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return stats;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        });
        stats.delivered++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          stats.expired++;
        } else {
          stats.failed++;
          // eslint-disable-next-line no-console
          console.error('[push] send failed for', sub.endpoint, err);
        }
      }
    }),
  );
  return stats;
}
