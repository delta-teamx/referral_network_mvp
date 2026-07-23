import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../notifications/notifications.service.js';

/**
 * Support chat — the floating widget on the marketing site and dashboard.
 * A visitor (signed in or not) opens a ticket; messages flow both ways.
 * Agents answer from the admin console's "Support tickets" tab.
 *
 * Live-hours logic: 9am–5pm US Eastern on weekdays gets a "we're online"
 * auto-greeting; outside that window the greeting says the team will follow
 * up soon. Either way the ticket lands in the admin queue immediately.
 */

const ticketSelect = {
  id: true,
  name: true,
  email: true,
  topic: true,
  status: true,
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
    ? `Thanks ${first}! Your message reached our support team — someone is online now and will jump in shortly.`
    : `Thanks ${first}! Our live team is online weekdays 9am–5pm ET. Your message has been logged and the right person will get back to you as soon as they're in — we'll fix this for you soon. Thanks for understanding!`;
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
        body: `${ticket.topic} — reply from Admin → Support tickets.`,
        data: { ticketId: ticket.id },
      }).catch(() => undefined),
    ),
  );

  return getTicket(ticket.id);
}

/** Ticket + full thread. The ticket id (uuid) is the access token. */
export async function getTicket(ticketId: string) {
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
  return { ...ticket, online: isSupportOnline() };
}

export async function addVisitorMessage(ticketId: string, text: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderType: 'user', body: sanitizeText(text).slice(0, 4000) },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'open' },
  });
  return getTicket(ticketId);
}

// ── Admin side ──────────────────────────────────────────────────────────────

export async function listTickets(status?: string) {
  return prisma.supportTicket.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    orderBy: { updatedAt: 'desc' },
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
    select: { id: true },
  });
  if (!ticket) throw AppError.notFound('Ticket not found');
  await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderType: 'agent', body: sanitizeText(text).slice(0, 4000) },
  });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: 'pending' },
  });
  return getTicket(ticketId);
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
