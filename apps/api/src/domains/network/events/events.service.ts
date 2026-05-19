import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { createZoomMeeting } from '../../integrations/zoom.service.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { env } from '../../../config/env.js';

export interface CreateEventInput {
  title: string;
  description?: string;
  startsAt: Date;
  durationMin?: number;
  maxAttendees?: number;
  isRecurring?: boolean;
  recurrenceRule?: string;
  createdById?: string;
}

export async function createEvent(input: CreateEventInput) {
  if (input.startsAt.getTime() < Date.now() - 60_000) {
    throw AppError.badRequest('Event start time must be in the future');
  }
  const zoom = await createZoomMeeting({
    topic: input.title,
    startsAt: input.startsAt,
    durationMin: input.durationMin ?? 30,
  });
  const event = await prisma.networkingEvent.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      startsAt: input.startsAt,
      durationMin: input.durationMin ?? 30,
      maxAttendees: input.maxAttendees ?? 100,
      isRecurring: input.isRecurring ?? false,
      recurrenceRule: input.recurrenceRule ?? null,
      zoomUrl: zoom.joinUrl,
      zoomMeetingId: zoom.meetingId,
      createdById: input.createdById ?? null,
    },
    select: eventSelect,
  });
  await eventBus.publish('networking_event.created', { eventId: event.id });
  return event;
}

export async function updateEvent(eventId: string, patch: Partial<CreateEventInput> & { status?: string }) {
  const existing = await prisma.networkingEvent.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!existing) throw AppError.notFound('Event not found');
  return prisma.networkingEvent.update({
    where: { id: eventId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
      ...(patch.durationMin !== undefined ? { durationMin: patch.durationMin } : {}),
      ...(patch.maxAttendees !== undefined ? { maxAttendees: patch.maxAttendees } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.recurrenceRule !== undefined ? { recurrenceRule: patch.recurrenceRule ?? null } : {}),
    },
    select: eventSelect,
  });
}

export async function cancelEvent(eventId: string) {
  return prisma.networkingEvent.update({ where: { id: eventId }, data: { status: 'canceled' }, select: eventSelect });
}

export async function listUpcomingEvents() {
  return prisma.networkingEvent.findMany({
    where: { status: { in: ['scheduled', 'live'] }, startsAt: { gte: new Date() } },
    orderBy: { startsAt: 'asc' }, take: 50, select: eventSelect,
  });
}

export async function listAllEvents(limit = 100) {
  return prisma.networkingEvent.findMany({ orderBy: { startsAt: 'desc' }, take: limit, select: eventSelect });
}

export async function getEvent(eventId: string, viewerId?: string) {
  const event = await prisma.networkingEvent.findUnique({
    where: { id: eventId },
    select: {
      ...eventSelect,
      registrations: {
        select: {
          userId: true,
          user: { select: { firstName: true, lastName: true, memberProfile: { select: { businessName: true, industry: true } } } },
        },
      },
    },
  });
  if (!event) throw AppError.notFound('Event not found');
  const registered = viewerId ? event.registrations.some((r) => r.userId === viewerId) : false;
  return { ...event, viewerRegistered: registered };
}

export async function registerForEvent(eventId: string, userId: string) {
  const event = await prisma.networkingEvent.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, maxAttendees: true, _count: { select: { registrations: true } } },
  });
  if (!event) throw AppError.notFound('Event not found');
  if (event.status !== 'scheduled' && event.status !== 'live') throw AppError.badRequest('Event is not open for registration');
  if (event._count.registrations >= event.maxAttendees) throw AppError.badRequest('Event is at capacity');
  const existing = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } });
  if (existing) return { alreadyRegistered: true };
  await prisma.eventRegistration.create({ data: { eventId, userId } });
  await eventBus.publish('networking_event.registered', { eventId, userId });
  return { alreadyRegistered: false };
}

export async function unregister(eventId: string, userId: string) {
  const reg = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } });
  if (!reg) return { ok: true };
  await prisma.eventRegistration.delete({ where: { id: reg.id } });
  return { ok: true };
}

export async function listMyRegistrations(userId: string) {
  const rows = await prisma.eventRegistration.findMany({
    where: { userId, event: { status: { in: ['scheduled', 'live'] } } },
    orderBy: { event: { startsAt: 'asc' } },
    select: { id: true, createdAt: true, event: { select: eventSelect } },
  });
  return rows.map((r) => ({ ...r.event, registeredAt: r.createdAt, registrationId: r.id }));
}

const eventSelect = {
  id: true, title: true, description: true, startsAt: true, durationMin: true,
  zoomUrl: true, zoomMeetingId: true, maxAttendees: true, status: true,
  isRecurring: true, recurrenceRule: true, createdAt: true,
  _count: { select: { registrations: true } },
} as const;

export async function inviteUsersToEvent(eventId: string, userIds: string[]) {
  const event = await prisma.networkingEvent.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, startsAt: true, zoomUrl: true },
  });
  if (!event) throw AppError.notFound('Event not found');

  const results: { userId: string; status: string }[] = [];
  for (const userId of userIds) {
    try {
      await prisma.eventRegistration.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: { eventId, userId },
        update: {},
      });
      results.push({ userId, status: 'registered' });
    } catch {
      results.push({ userId, status: 'failed' });
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { email: true, firstName: true },
  });

  const origin = env.FRONTEND_URL.split(',')[0];
  for (const user of users) {
    void sendEmail({
      to: user.email,
      template: 'event_registered',
      data: {
        title: event.title,
        whenLabel: new Date(event.startsAt).toLocaleString('en-US', {
          weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        }),
        zoomUrl: event.zoomUrl ?? '#',
        eventUrl: `${origin}/events`,
      },
    });
  }

  await eventBus.publish('admin.event_participants_invited', { eventId, userCount: userIds.length });
  return { invited: results.length, results };
}
