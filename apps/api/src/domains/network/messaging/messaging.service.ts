import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';

/**
 * In-app messaging between two users.
 *
 * Every conversation is 1-to-1 (two participants). Group chat is out of
 * scope for the MVP. The service enforces participant membership on every
 * read/write so users can never see other people's conversations.
 */

// ---------------------------------------------------------------------------
// getOrCreateConversation
// ---------------------------------------------------------------------------

export async function getOrCreateConversation(
  userIdA: string,
  userIdB: string,
) {
  if (userIdA === userIdB) {
    throw AppError.badRequest("You can't message yourself.");
  }

  // The route only validates that userIdB is a UUID — confirm the target user
  // actually exists (and isn't soft-deleted) before creating participant rows,
  // otherwise the FK insert throws a raw 500 instead of a clean 404.
  const target = await prisma.user.findFirst({
    where: { id: userIdB, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw AppError.notFound('That member no longer exists.');

  // Look for an existing 1-on-1 conversation between the two users.
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: { id: true },
  });

  if (existing) return existing;

  // Create a new conversation with both participants.
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        createMany: {
          data: [{ userId: userIdA }, { userId: userIdB }],
        },
      },
    },
    select: { id: true },
  });

  return conversation;
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
) {
  // Ensure sender is a participant.
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: senderId },
    select: { id: true },
  });
  if (!participant) {
    throw AppError.forbidden('You are not a participant of this conversation.');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text: sanitizeText(text),
    },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      text: true,
      createdAt: true,
    },
  });

  // Touch the conversation updatedAt so list ordering stays fresh.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

// ---------------------------------------------------------------------------
// listConversations
// ---------------------------------------------------------------------------

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      updatedAt: true,
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          senderId: true,
          text: true,
          createdAt: true,
        },
      },
    },
  });

  return conversations.map((c) => {
    const otherParticipant = c.participants.find((p) => p.userId !== userId);
    const myParticipant = c.participants.find((p) => p.userId === userId);
    const lastMessage = c.messages[0] ?? null;

    return {
      id: c.id,
      updatedAt: c.updatedAt,
      otherUser: otherParticipant
        ? {
            id: otherParticipant.user.id,
            firstName: otherParticipant.user.firstName,
            lastName: otherParticipant.user.lastName,
            avatarUrl: otherParticipant.user.avatarUrl,
          }
        : null,
      lastMessage,
      unread:
        lastMessage && myParticipant
          ? !myParticipant.lastReadAt ||
            lastMessage.createdAt > myParticipant.lastReadAt
          : false,
    };
  });
}

// ---------------------------------------------------------------------------
// listMessages
// ---------------------------------------------------------------------------

export async function listMessages(
  conversationId: string,
  userId: string,
  limit = 50,
) {
  // Ensure user is a participant.
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  });
  if (!participant) {
    throw AppError.forbidden('You are not a participant of this conversation.');
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      senderId: true,
      text: true,
      createdAt: true,
    },
  });

  // Mark conversation as read for this user.
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });

  return messages;
}
