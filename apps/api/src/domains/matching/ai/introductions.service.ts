import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { createNotification } from '../../core/notifications/notifications.service.js';
import { getOrCreateConversation, sendMessage } from '../../network/messaging/messaging.service.js';

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

  const updated = await prisma.introduction.update({
    where: { id: intro.id },
    data: { status: 'requested', requestedAt: new Date() },
    select: introSelect,
  });

  // Alert the target in the bell (best-effort).
  void createNotification({
    userId: updated.target.id,
    type: 'intro_request',
    title: `${updated.sender.firstName} ${updated.sender.lastName} wants an intro`,
    body: 'Review the request in your Leads inbox or on your dashboard and accept to start the conversation.',
    data: { introId: updated.id },
  }).catch(() => undefined);

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

  // The matcher creates a suggestion in each direction — resolve the mirror
  // row too, so the same pair can't keep resurfacing as a fresh request.
  await prisma.introduction.updateMany({
    where: {
      senderId: userId,
      targetId: intro.senderId,
      status: { in: ['suggested', 'requested'] },
    },
    data: {
      status: action === 'accept' ? 'accepted' : 'declined',
      acceptedAt: action === 'accept' ? new Date() : null,
    },
  });

  if (action === 'accept') {
    // An accepted intro is a real relationship: put it in both members'
    // networks as an accepted connection (idempotent).
    const existingConn = await prisma.businessConnection.findFirst({
      where: {
        OR: [
          { initiatorId: intro.senderId, targetId: userId },
          { initiatorId: userId, targetId: intro.senderId },
        ],
      },
      select: { id: true, status: true },
    });
    if (!existingConn) {
      await prisma.businessConnection.create({
        data: {
          initiatorId: intro.senderId,
          targetId: userId,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    } else if (existingConn.status === 'pending') {
      await prisma.businessConnection.update({
        where: { id: existingConn.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
    }
    await eventBus.publish('business_connection.requested', {
      connectionId: intro.id,
      initiatorId: intro.senderId,
      targetId: userId,
    });

    // Accepting an intro STARTS the relationship: open the conversation with
    // the match details as the first message, and tell the requester. All
    // best-effort — the accept itself never fails on these.
    void (async () => {
      const conversation = await getOrCreateConversation(userId, intro.senderId);
      await sendMessage(
        conversation.id,
        userId,
        `Hi ${updated.sender.firstName} — I accepted your intro request. Why we matched: ${updated.reason} Let's find a time to talk — happy to jump on a call.`,
      );
      await createNotification({
        userId: intro.senderId,
        type: 'intro_accepted',
        title: `${updated.target.firstName} ${updated.target.lastName} accepted your intro 🎉`,
        body: 'A conversation has been started — continue in Messages and set up a call.',
        data: { introId: updated.id, conversationId: conversation.id },
      });
    })().catch(() => undefined);
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
