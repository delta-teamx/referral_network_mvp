import { prisma } from '../../../config/prisma.js';
import { sendEmail } from './email.service.js';
import { isUserOnline } from '../../../realtime/io.js';

/**
 * Offline-only notification digest.
 *
 * Runs every 10 minutes (see scheduler). For each member who has unread
 * message / intro-request notifications AND is NOT currently connected over a
 * socket, it bundles those into a single email instead of the old
 * one-email-per-event blast. Active members get nothing - they already saw the
 * bell ring and the message arrive in real time.
 *
 * A per-user cursor (stored on a DomainEvent row keyed `digest:<userId>`)
 * records the timestamp of the newest item already digested, so nothing is
 * emailed twice and only genuinely-new activity triggers the next digest.
 */

/** Notification types the digest bundles. Booking requests stay immediate
 *  (time-sensitive) and are intentionally excluded. */
const DIGEST_TYPES = ['message', 'intro_request'];

/** Bound the candidate scan so the job stays cheap on a large table. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

function cursorId(userId: string): string {
  return `digest:${userId}`;
}

async function getDigestCursor(userId: string): Promise<Date | null> {
  const row = await prisma.domainEvent.findUnique({
    where: { id: cursorId(userId) },
    select: { payload: true },
  });
  const payload = row?.payload as { lastDigestAt?: string } | null;
  return payload?.lastDigestAt ? new Date(payload.lastDigestAt) : null;
}

async function setDigestCursor(userId: string, at: Date): Promise<void> {
  const payload = { lastDigestAt: at.toISOString() };
  await prisma.domainEvent.upsert({
    where: { id: cursorId(userId) },
    create: { id: cursorId(userId), type: 'email.digest', aggregateId: userId, payload },
    update: { payload },
  });
}

/**
 * Send one digest email to every offline member with new unread message /
 * intro-request notifications. Returns counts for the scheduler log.
 */
export async function runNotificationDigests(): Promise<{ scanned: number; sent: number }> {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MS);

  // Candidate members: anyone with a recent unread digestable notification.
  const candidates = await prisma.notification.groupBy({
    by: ['userId'],
    where: { isRead: false, type: { in: DIGEST_TYPES }, createdAt: { gt: since } },
  });

  let scanned = 0;
  let sent = 0;

  for (const c of candidates) {
    scanned++;
    const userId = c.userId;

    // Offline-only: skip anyone with a live socket - they're seeing it in-app.
    if (isUserOnline(userId)) continue;

    const lastDigestAt = await getDigestCursor(userId);
    // Only consider items newer than both the lookback window and the last
    // digest, so nothing is emailed twice.
    const cursor = lastDigestAt && lastDigestAt > since ? lastDigestAt : since;

    const notes = await prisma.notification.findMany({
      where: { userId, isRead: false, type: { in: DIGEST_TYPES }, createdAt: { gt: cursor } },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { type: true, title: true, body: true, createdAt: true },
    });
    if (notes.length === 0) continue;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, deletedAt: true, emailVerified: true },
    });
    // Advance the cursor even when we can't email, so an unreachable account
    // isn't rescanned every cycle.
    const newestAt = notes[0]!.createdAt;
    if (!user?.email || user.deletedAt || !user.emailVerified) {
      await setDigestCursor(userId, newestAt);
      continue;
    }

    const messageCount = notes.filter((n) => n.type === 'message').length;
    const introCount = notes.filter((n) => n.type === 'intro_request').length;

    try {
      await sendEmail({
        to: user.email,
        template: 'digest',
        data: {
          firstName: user.firstName,
          messageCount,
          introCount,
          items: notes.slice(0, 6).map((n) => ({ type: n.type, title: n.title, body: n.body })),
        },
      });
      sent++;
      // Only advance the cursor on a successful send, so a transient email
      // failure retries the same items next cycle instead of dropping them.
      await setDigestCursor(userId, newestAt);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[digest] send failed for ${userId}`, err);
    }
  }

  return { scanned, sent };
}
