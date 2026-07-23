import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { env } from '../../../config/env.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../../core/notifications/notifications.service.js';

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

  // Alert the recipient in the notification bell (best-effort).
  void (async () => {
    const [other, sender] = await Promise.all([
      prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: senderId } },
        select: { userId: true },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    if (!other) return;
    await createNotification({
      userId: other.userId,
      type: 'message',
      title: `New message from ${sender ? `${sender.firstName} ${sender.lastName}` : 'a member'}`,
      body: message.text.slice(0, 120),
      data: { conversationId },
    });
  })().catch(() => undefined);

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
// Chat attachments (documents / contracts / images) via S3 presigned upload
// ---------------------------------------------------------------------------

const ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB

export async function presignChatAttachment(
  conversationId: string,
  userId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  });
  if (!participant) throw AppError.forbidden('You are not a participant of this conversation.');
  if (!ATTACHMENT_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported file type. Use PDF, Word, Excel, image or text.');
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw AppError.badRequest('File too large. Max 15MB.');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.badRequest('File uploads are not configured yet.');
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const key = `chat/${conversationId}/${crypto.randomUUID()}-${safeName}`;

  // @ts-expect-error — AWS SDK is optional at build time.
  const s3Mod = await import('@aws-sdk/client-s3');
  // @ts-expect-error — ditto.
  const presignerMod = await import('@aws-sdk/s3-request-presigner');
  const { S3Client, PutObjectCommand } = s3Mod;
  const { getSignedUrl } = presignerMod;

  const s3 = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  const cmd = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  return { uploadUrl, publicUrl };
}

/** Mark a conversation read for the given user (sets lastReadAt = now). */
export async function markConversationRead(conversationId: string, userId: string) {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
  return { ok: true };
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
