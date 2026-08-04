import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sendEmail } from '../notifications/email.service.js';
import {
  deliverBroadcastToMember,
  getAnnouncerUserId,
} from '../../network/messaging/messaging.service.js';
import { SYSTEM_ACCOUNT_EMAILS } from '../../../config/system-accounts.js';

/**
 * Founder / team broadcasts.
 *
 * An admin (e.g. Brian Parnel, Founder) writes one message; it is delivered to
 * EVERY member in two places only:
 *   1. their Messages inbox, as a one-way official "Referral Nova" announcement
 *      thread (pinned, visible on any plan, and - like ROUL threads -
 *      deliberately excluded from the pipeline), and
 *   2. their email inbox.
 *
 * It never creates a pipeline card and never touches analytics: an announcement
 * is not a lead. The sender's specific name + title ride inside the message and
 * email, so any admin can broadcast under their own name.
 */

const DELIVERY_BATCH = 25;

export interface SendBroadcastInput {
  adminId: string;
  senderName: string;
  senderTitle?: string;
  subject: string;
  body: string;
}

/** The in-app message body members see in their announcement thread. */
function composeThreadText(input: SendBroadcastInput): string {
  const signature = input.senderTitle
    ? `— ${input.senderName}, ${input.senderTitle}`
    : `— ${input.senderName}`;
  return `📣 ${input.subject}\n\n${input.body}\n\n${signature}`;
}

/** Send a broadcast to every active member. Per-recipient failures are isolated
 *  (best-effort) so one bad email/thread never aborts the whole fan-out. */
export async function sendBroadcast(
  input: SendBroadcastInput,
): Promise<{ id: string; recipientCount: number; emailCount: number }> {
  const senderName = input.senderName.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  const senderTitle = input.senderTitle?.trim() || undefined;
  if (!senderName) throw AppError.badRequest('A sender name is required.');
  if (!subject) throw AppError.badRequest('A subject is required.');
  if (!body) throw AppError.badRequest('A message is required.');
  if (subject.length > 160) throw AppError.badRequest('Subject is too long (max 160).');
  if (body.length > 5000) throw AppError.badRequest('Message is too long (max 5000).');

  // Target = real members only. System accounts (ROUL, announcer) and admins
  // are ADMIN role and excluded; soft-deleted accounts are excluded.
  const members = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { not: 'ADMIN' },
      NOT: { email: { in: SYSTEM_ACCOUNT_EMAILS } },
    },
    select: { id: true, email: true, firstName: true },
  });

  // Create + cache the announcer account ONCE up front, so the concurrent
  // delivery batch below never races to create it (that race dropped ~24 of the
  // first batch and spammed duplicate-key errors).
  await getAnnouncerUserId();

  const threadText = composeThreadText({ ...input, senderName, senderTitle, subject, body });
  let recipientCount = 0;
  let emailCount = 0;

  for (let i = 0; i < members.length; i += DELIVERY_BATCH) {
    const batch = members.slice(i, i + DELIVERY_BATCH);
    const results = await Promise.allSettled(
      batch.map(async (m) => {
        // In-app inbox + bell (deliverBroadcastToMember creates the bell
        // notification via sendMessage).
        await deliverBroadcastToMember(m.id, threadText);
        let emailed = false;
        if (m.email) {
          try {
            await sendEmail({
              to: m.email,
              template: 'broadcast',
              data: {
                firstName: m.firstName || 'there',
                senderName,
                senderTitle: senderTitle ?? '',
                subject,
                message: body,
              },
            });
            emailed = true;
          } catch {
            // email is best-effort; the in-app message still landed
          }
        }
        return emailed;
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        recipientCount += 1;
        if (r.value) emailCount += 1;
      }
    }
  }

  const record = await prisma.broadcast.create({
    data: {
      senderAdminId: input.adminId,
      senderName,
      senderTitle: senderTitle ?? null,
      subject,
      body,
      audience: 'all',
      recipientCount,
      emailCount,
    },
    select: { id: true },
  });

  return { id: record.id, recipientCount, emailCount };
}

/** How many members a broadcast would reach right now (for the composer). */
export async function countBroadcastAudience(): Promise<number> {
  return prisma.user.count({
    where: {
      deletedAt: null,
      role: { not: 'ADMIN' },
      NOT: { email: { in: SYSTEM_ACCOUNT_EMAILS } },
    },
  });
}

/** Broadcast history for the admin console, newest first. */
export async function listBroadcasts(limit = 50) {
  return prisma.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      senderName: true,
      senderTitle: true,
      subject: true,
      body: true,
      recipientCount: true,
      emailCount: true,
      createdAt: true,
    },
  });
}
