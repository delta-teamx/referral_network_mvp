import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../notifications/notifications.service.js';
import { deleteAttachmentPrefixes } from '../../network/messaging/messaging.service.js';

/**
 * Support chat - the floating widget on the marketing site and dashboard.
 * A visitor (signed in or not) opens a ticket; messages flow both ways.
 * Agents answer from the admin console's "Support tickets" tab.
 *
 * Live-hours logic: 9am-5pm US Eastern on weekdays gets a "we're online"
 * auto-greeting; outside that window the greeting says the team will follow
 * up soon. Either way the ticket lands in the admin queue immediately.
 */

const ticketSelect = {
  id: true,
  name: true,
  email: true,
  topic: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} as const;

export function isSupportOnline(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const isWeekday = !['Sat', 'Sun'].includes(weekday);
  return isWeekday && hour >= 9 && hour < 17;
}

function autoGreeting(name: string): string {
  const first = name.split(' ')[0] || 'there';
  return isSupportOnline()
    ? `Thanks ${first}! Your message reached our support team - someone is online now and will jump in shortly.`
    : `Thanks ${first}! Our live team is online weekdays 9am-5pm ET. Your message has been logged and the right person will get back to you as soon as they're in - we'll fix this for you soon. Thanks for understanding!`;
}

export async function createTicket(input: {
  userId?: string;
  name: string;
  email: string;
  topic: string;
  message: string;
}) {
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: input.userId ?? null,
      name: sanitizeText(input.name).slice(0, 120),
      email: input.email.slice(0, 200),
      topic: sanitizeText(input.topic).slice(0, 200),
      status: 'open',
      messages: {
        create: [
          { senderType: 'user', body: sanitizeText(input.message).slice(0, 4000) },
          { senderType: 'system', body: autoGreeting(input.name) },
        ],
      },
    },
    select: ticketSelect,
  });

  // Surface the new ticket to every admin's bell.
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      createNotification({
        userId: a.id,
        type: 'support_ticket',
        title: `New support ticket from ${ticket.name}`,
        body: `${ticket.topic} - reply from Admin → Support tickets.`,
        data: { ticketId: ticket.id },
      }).catch(() => undefined),
    ),
  );

  return getTicket(ticket.id);
}

/**
 * Admin-initiated Priority Support thread. An admin opens a two-way ROUL
 * conversation with a specific member: the first message is the admin's note
 * (shown as ROUL / Support), the member can reply from their support widget,
 * and the whole thread lives in the admin console's Support tab under Priority.
 * Reaches every member (support is not plan-gated) and never touches pipelines.
 */
export async function createPriorityTicketForMember(input: {
  adminId: string;
  targetUserId: string;
  message: string;
  subject?: string;
}) {
  const member = await prisma.user.findFirst({
    where: { id: input.targetUserId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!member) throw AppError.notFound('That member no longer exists.');

  const topic = input.subject?.trim()
    ? input.subject.trim().slice(0, 200)
    : 'Message from Referral Nova';

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: member.id,
      name: `${member.firstName} ${member.lastName}`.trim() || member.email,
      email: member.email,
      topic: sanitizeText(topic),
      status: 'pending', // ROUL/admin has spoken; waiting on the member
      priority: true,
      messages: {
        create: [{ senderType: 'agent', body: sanitizeText(input.message).slice(0, 4000) }],
      },
    },
    select: ticketSelect,
  });

  // Ping the member's inbox so they see it even without the widget open. The
  // ticketId is carried so the notification deep-links straight to the thread.
  await createNotification({
    userId: member.id,
    type: 'admin_message',
    title: 'New message from ROUL (Referral Nova team)',
    body: `${sanitizeText(input.message).slice(0, 140)} — open Support to reply.`,
    data: { ticketId: ticket.id, from: 'ROUL', admin: true, adminId: input.adminId },
  }).catch(() => undefined);

  return getTicket(ticket.id);
}

/** The member's most recent support ticket (used by the widget to surface an
 *  admin-initiated Priority thread even if the member never opened one). */
export async function getMyLatestTicket(userId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { userId },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    select: { id: true },
  });
  return { ticketId: ticket?.id ?? null };
}

/**
 * Ticket + full thread. For anonymous visitors the unguessable ticket uuid is
 * the access token; for SIGNED-IN viewers the ticket must be their own (or
 * they must be an admin) - accounts never see each other's support threads.
 */
export async function getTicket(ticketId: string, viewer?: { id: string; role: string }) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      ...ticketSelect,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, senderType: true, body: true, createdAt: true },
      },
    },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (
    viewer &&
    viewer.role !== 'ADMIN' &&
    ticket.userId &&
    ticket.userId !== viewer.id
  ) {
    throw AppError.notFound('Ticket not found');
  }
  return { ...ticket, online: isSupportOnline() };
}

export async function addVisitorMessage(
  ticketId: string,
  text: string,
  viewer?: { id: string; role: string },
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, userId: true, priority: true, name: true, topic: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (viewer && viewer.role !== 'ADMIN' && ticket.userId && ticket.userId !== viewer.id) {
    throw AppError.notFound('Ticket not found');
  }
  const isAdminSender = viewer?.role === 'ADMIN';
  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      // An admin replying through this path still speaks as the agent/ROUL.
      senderType: isAdminSender ? 'agent' : 'user',
      body: sanitizeText(text).slice(0, 4000),
    },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: isAdminSender ? 'pending' : 'open' },
  });
  // A member reply on a Priority (admin-initiated) thread pings every admin so
  // the loop actually closes - "they reply, we get back to them".
  if (!isAdminSender && ticket.priority) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'support_ticket',
          title: `Priority reply from ${ticket.name}`,
          body: `${ticket.topic} — reply from Admin → Support (Priority).`,
          data: { ticketId: ticket.id },
        }).catch(() => undefined),
      ),
    );
  }
  return getTicket(ticketId, viewer);
}

// ── Admin side ──────────────────────────────────────────────────────────────

export async function listTickets(status?: string, opts?: { priorityOnly?: boolean }) {
  const where: { status?: string; priority?: boolean } = {};
  if (status && status !== 'all') where.status = status;
  if (opts?.priorityOnly) where.priority = true;
  return prisma.supportTicket.findMany({
    where: Object.keys(where).length ? where : undefined,
    // Priority (admin-initiated ROUL) threads always rise to the top.
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    select: {
      ...ticketSelect,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { senderType: true, body: true, createdAt: true },
      },
    },
  });
}

export async function agentReply(ticketId: string, text: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true, topic: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderType: 'agent', body: sanitizeText(text).slice(0, 4000) },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'pending' },
  });
  // Signed-in ticket owners see the reply in their bell too, so they don't
  // have to keep the widget open.
  if (ticket.userId) {
    void createNotification({
      userId: ticket.userId,
      type: 'support_reply',
      title: 'Support replied to your ticket 💬',
      body: `${ticket.topic} - open the Support chat (bottom-right) to read it.`,
      data: { ticketId: ticket.id },
    }).catch(() => undefined);
  }
  return getTicket(ticketId);
}

/** HARD delete a ticket: thread rows go from the database, files from S3. */
export async function deleteTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, name: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  // SupportMessage rows cascade with the ticket.
  await prisma.supportTicket.delete({ where: { id: ticket.id } });
  void deleteAttachmentPrefixes([`support/${ticket.id}/`]);
  return { deleted: ticket.name };
}

export async function setTicketStatus(ticketId: string, status: 'open' | 'pending' | 'closed') {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  return prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status },
    select: ticketSelect,
  });
}
