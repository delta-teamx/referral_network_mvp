import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

/**
 * Introduction lifecycle — manage AI-suggested introductions between members.
 *
 * Flow: suggested → requested → accepted → completed (with outcome)
 *                 → declined
 */

const introSelect = {
  id: true,
  reason: true,
  matchScore: true,
  matchFactors: true,
  status: true,
  outcome: true,
  dealValue: true,
  notes: true,
  requestedAt: true,
  acceptedAt: true,
  completedAt: true,
  createdAt: true,
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      memberProfile: {
        select: {
          businessName: true,
          industry: true,
          headline: true,
          videoUrl: true,
          city: true,
          state: true,
        },
      },
    },
  },
  target: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      memberProfile: {
        select: {
          businessName: true,
          industry: true,
          headline: true,
          videoUrl: true,
          city: true,
          state: true,
        },
      },
    },
  },
} as const;

export async function listSuggestionsForUser(userId: string) {
  return prisma.introduction.findMany({
    where: {
      OR: [{ senderId: userId }, { targetId: userId }],
      status: { in: ['suggested', 'requested'] },
    },
    orderBy: { matchScore: 'desc' },
    take: 20,
    select: introSelect,
  });
}

export async function listCompletedIntros(userId: string) {
  return prisma.introduction.findMany({
    where: {
      OR: [{ senderId: userId }, { targetId: userId }],
      status: { in: ['accepted', 'completed', 'declined'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: introSelect,
  });
}

export async function requestIntroByTarget(senderId: string, targetUserId: string) {
  if (senderId === targetUserId) throw AppError.badRequest('Cannot request intro to yourself');

  const targetExists = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, deletedAt: true },
  });
  if (!targetExists || targetExists.deletedAt) throw AppError.notFound('Member not found');

  const existing = await prisma.introduction.findFirst({
    where: {
      senderId,
      targetId: targetUserId,
      status: { in: ['suggested', 'requested', 'accepted'] },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === 'suggested') {
      const updated = await prisma.introduction.update({
        where: { id: existing.id },
        data: { status: 'requested', requestedAt: new Date() },
        select: introSelect,
      });
      await eventBus.publish('intro.requested', {
        introId: existing.id,
        senderId,
        targetId: targetUserId,
      });
      return updated;
    }
    return prisma.introduction.findUnique({
      where: { id: existing.id },
      select: introSelect,
    });
  }

  const { generateMatchesForUser } = await import('./ai-matching.service.js');
  const matches = await generateMatchesForUser(senderId, { limit: 200 });
  const match = matches.find((m) => m.targetUserId === targetUserId);

  const created = await prisma.introduction.create({
    data: {
      senderId,
      targetId: targetUserId,
      reason: match?.reason ?? 'Member-initiated intro request',
      matchScore: match?.score ?? 0,
      matchFactors: match?.factors ?? {},
      status: 'requested',
      requestedAt: new Date(),
    },
    select: introSelect,
  });

  await eventBus.publish('intro.requested', {
    introId: created.id,
    senderId,
    targetId: targetUserId,
  });

  return created;
}

export async function requestIntro(introId: string, userId: string) {
  const intro = await prisma.introduction.findFirst({
    where: { id: introId, senderId: userId, status: 'suggested' },
    select: { id: true, targetId: true },
  });
  if (!intro) throw AppError.notFound('Suggestion not found');

  const updated = await prisma.introduction.update({
    where: { id: intro.id },
    data: { status: 'requested', requestedAt: new Date() },
    select: introSelect,
  });

  await eventBus.publish('intro.requested', {
    introId: intro.id,
    senderId: userId,
    targetId: intro.targetId,
  });

  return updated;
}

export async function respondToIntro(
  introId: string,
  userId: string,
  action: 'accept' | 'decline',
) {
  const intro = await prisma.introduction.findFirst({
    where: { id: introId, targetId: userId, status: 'requested' },
    select: { id: true, senderId: true },
  });
  if (!intro) throw AppError.notFound('Intro request not found');

  const updated = await prisma.introduction.update({
    where: { id: intro.id },
    data: {
      status: action === 'accept' ? 'accepted' : 'declined',
      acceptedAt: action === 'accept' ? new Date() : null,
    },
    select: introSelect,
  });

  if (action === 'accept') {
    await eventBus.publish('business_connection.requested', {
      connectionId: intro.id,
      initiatorId: intro.senderId,
      targetId: userId,
    });
    await eventBus.publish('intro.accepted', {
      introId: intro.id,
      senderId: intro.senderId,
      targetId: userId,
    });
  }

  return updated;
}

export async function completeIntro(
  introId: string,
  userId: string,
  input: { outcome: string; dealValue?: number; notes?: string },
) {
  const intro = await prisma.introduction.findFirst({
    where: {
      id: introId,
      OR: [{ senderId: userId }, { targetId: userId }],
      status: 'accepted',
    },
    select: { id: true },
  });
  if (!intro) throw AppError.notFound('Accepted intro not found');

  return prisma.introduction.update({
    where: { id: intro.id },
    data: {
      status: 'completed',
      outcome: input.outcome,
      dealValue: input.dealValue ?? null,
      notes: input.notes?.trim() || null,
      completedAt: new Date(),
    },
    select: introSelect,
  });
}
