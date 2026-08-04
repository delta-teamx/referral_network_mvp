import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../notifications/notifications.service.js';
import { deleteAttachmentPrefixes } from '../../network/messaging/messaging.service.js';
import { emitToAdmins, emitToUser } from '../../../realtime/io.js';

/**
 * C5: push a live support update to the ticket owner (if signed in) and to
 * every connected admin, so the widget + admin console refresh in real time
 * instead of on a poll. Payload is just the ticketId - clients refetch the
 * thread, which keeps this dead simple and dedupe-free.
 */
function emitSupportUpdate(ticketId: string, memberUserId?: string | null): void {
  if (memberUserId) emitToUser(memberUserId, 'support:message', { ticketId });
  emitToAdmins('support:message', { ticketId });
}

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
  humanTakeover: true,
  assignedAdminId: true,
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
    where: { role: 'ADMIN', deletedAt: null, NOT: { email: 'roul-support@referralnova.com' } },
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

  emitSupportUpdate(ticket.id, ticket.userId);
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

  emitSupportUpdate(ticket.id, member.id);
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
    select: {
      id: true,
      status: true,
      userId: true,
      priority: true,
      humanTakeover: true,
      name: true,
      topic: true,
    },
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
    // Admin reply clears the escalation flag; a member reply reopens the ticket.
    data: isAdminSender ? { status: 'pending', escalatedAt: null } : { status: 'open' },
  });
  // A member reply on a Priority OR taken-over thread pings every admin so the
  // loop actually closes - "they reply, we get back to them".
  if (!isAdminSender && (ticket.priority || ticket.humanTakeover)) {
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
  emitSupportUpdate(ticket.id, ticket.userId);
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
    // An admin answered - clear the escalation flag so the 30-min timer can
    // fire fresh if the member is later left waiting again.
    data: { status: 'pending', escalatedAt: null },
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
  emitSupportUpdate(ticket.id, ticket.userId);
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

// ── C1: ROUL persistence + admin takeover ────────────────────────────────────

/**
 * Read a ticket's takeover state + recent thread as ROUL history, so the
 * support route can decide whether ROUL should answer and give it context.
 */
export async function getRoulTicketContext(ticketId: string): Promise<{
  humanTakeover: boolean;
  history: { role: 'user' | 'assistant'; content: string }[];
} | null> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      humanTakeover: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { senderType: true, body: true },
      },
    },
  });
  if (!ticket) return null;
  const history = ticket.messages
    .reverse()
    .filter((m) => m.senderType === 'user' || m.senderType === 'roul' || m.senderType === 'agent')
    .map((m) => ({
      role: (m.senderType === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));
  return { humanTakeover: ticket.humanTakeover, history };
}

/**
 * Persist a ROUL answer into the ticket thread (senderType 'roul') so admins
 * see ROUL's side of the conversation, not just the member's. Clears the
 * escalation flag since the member just got a response.
 */
export async function persistRoulReply(ticketId: string, answer: string): Promise<void> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, humanTakeover: true },
  });
  if (!ticket) return;
  // Re-check takeover at WRITE time: an admin may have grabbed the ticket during
  // the (up to 8s) OpenAI call. If so, ROUL stays silent - the human owns it.
  if (ticket.humanTakeover) return;
  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderType: 'roul', body: sanitizeText(answer).slice(0, 4000) },
  });
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'pending', escalatedAt: null },
    select: { userId: true },
  });
  emitSupportUpdate(ticket.id, updated.userId);
}

/** Admin takes over a ticket: ROUL stops auto-replying; the admin owns it. */
export async function takeOverTicket(ticketId: string, adminId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { humanTakeover: true, assignedAdminId: adminId },
    select: ticketSelect,
  });
  // Let the member know a real person is now on it.
  if (ticket.userId) {
    void createNotification({
      userId: ticket.userId,
      type: 'support_reply',
      title: 'A specialist is helping you 👋',
      body: 'One of our team has personally picked up your support conversation.',
      data: { ticketId: ticket.id },
    }).catch(() => undefined);
  }
  emitSupportUpdate(ticket.id, ticket.userId);
  return updated;
}

/** Hand a ticket back to ROUL. */
export async function releaseTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { humanTakeover: false, assignedAdminId: null },
    select: ticketSelect,
  });
  emitSupportUpdate(ticket.id, ticket.userId);
  return updated;
}

// ── C2: 30-minute "still waiting" escalation timer ───────────────────────────

/**
 * Escalate tickets where the member has been left waiting too long. A ticket
 * qualifies when its newest message is from the member, it's 30+ minutes old,
 * the ticket isn't closed, and it hasn't already been escalated for THIS wait
 * (escalatedAt is null or predates the member's last message). This is the
 * safety net for the "ROUL/admin went quiet" case, distinct from ROUL's
 * instant "I can't resolve this" escalation.
 */
export async function runSupportEscalationSweep(): Promise<{ scanned: number; escalated: number }> {
  const { escalateToTechnicalAdmin } = await import('./roul.service.js');
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);

  const candidates = await prisma.supportTicket.findMany({
    where: { status: { not: 'closed' } },
    select: {
      id: true,
      name: true,
      email: true,
      userId: true,
      escalatedAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { senderType: true, body: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  let escalated = 0;
  for (const t of candidates) {
    // messages are newest-first. Find the member's most recent message and the
    // most recent REAL reply (agent or ROUL). A `system` auto-greeting does NOT
    // count as a reply - otherwise a freshly-opened, never-answered ticket (its
    // newest message is the greeting) would be skipped forever.
    const lastUser = t.messages.find((m) => m.senderType === 'user');
    if (!lastUser) continue; // member never wrote - nothing to wait on
    const lastReply = t.messages.find(
      (m) => m.senderType === 'agent' || m.senderType === 'roul',
    );
    if (lastReply && lastReply.createdAt >= lastUser.createdAt) continue; // already answered
    if (lastUser.createdAt > cutoff) continue; // not yet 30 min
    // Already escalated for this same wait? (escalatedAt at/after the member's msg)
    if (t.escalatedAt && t.escalatedAt >= lastUser.createdAt) continue;

    const transcript = [...t.messages]
      .reverse()
      .map((m) => ({
        role: (m.senderType === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.body,
      }));
    try {
      await escalateToTechnicalAdmin(
        { id: t.userId ?? undefined, name: t.name, email: t.email },
        transcript,
        'No response for 30+ minutes (auto-escalated)',
        t.id,
      );
      await prisma.supportTicket.update({
        where: { id: t.id },
        data: { escalatedAt: new Date() },
      });
      escalated++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[support] escalation sweep failed for ${t.id}`, err);
    }
  }

  return { scanned: candidates.length, escalated };
}
