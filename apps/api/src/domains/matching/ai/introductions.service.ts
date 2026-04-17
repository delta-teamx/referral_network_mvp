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

export async function requestIntro(introId: string, userId: string) {
  const intro = await prisma.introduction.findFirst({
    where: { id: introId, senderId: userId, status: 'suggested' },
    select: { id: true },
  });
  if (!intro) throw AppError.notFound('Suggestion not found');

  return prisma.introduction.update({
    where: { id: intro.id },
    data: { status: 'requested', requestedAt: new Date() },
    select: introSelect,
  });
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
