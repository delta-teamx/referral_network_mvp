import type { Socket } from 'socket.io';
import { prisma } from '../../../config/prisma.js';
import { emitToUser, onConnection } from '../../../realtime/io.js';

/**
 * Realtime handlers for the messenger: typing indicators and delivery acks.
 *
 * These live in the messaging domain (not the leaf realtime module) because
 * they need to validate conversation membership against the DB. Membership is
 * cached briefly so a fast typing stream doesn't hammer Postgres.
 */

interface ParticipantsCacheEntry {
  ids: string[];
  expiresAt: number;
}
const participantsCache = new Map<string, ParticipantsCacheEntry>();
const PARTICIPANTS_TTL_MS = 30_000;

/** Participant user ids for a conversation, cached for a short window. */
async function getParticipantIds(conversationId: string, now: number): Promise<string[]> {
  const cached = participantsCache.get(conversationId);
  if (cached && cached.expiresAt > now) return cached.ids;
  const parts = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const ids = parts.map((p) => p.userId);
  participantsCache.set(conversationId, { ids, expiresAt: now + PARTICIPANTS_TTL_MS });
  return ids;
}

/** Invalidate the cache when a conversation's membership changes. */
export function invalidateParticipants(conversationId: string): void {
  participantsCache.delete(conversationId);
}

/**
 * Emit a freshly-sent message to every participant's room. The sender's other
 * tabs get it too (they dedupe by message id), so all their devices stay in
 * sync without a refetch.
 */
export function emitNewMessage(
  participantIds: string[],
  payload: { conversationId: string; message: unknown },
): void {
  for (const uid of participantIds) emitToUser(uid, 'message:new', payload);
}

/** Tell the other participant that `readerId` has read the thread up to `readAt`. */
export function emitRead(
  otherUserId: string,
  payload: { conversationId: string; readerId: string; readAt: string },
): void {
  emitToUser(otherUserId, 'message:read', payload);
}

/** Wire up per-socket typing + delivery-ack relays. Call once at boot. */
export function registerMessagingRealtime(): void {
  onConnection((socket: Socket, userId: string) => {
    // ---- Typing indicator -------------------------------------------------
    // Client sends { conversationId, isTyping }. We relay to the OTHER
    // participant only, and only if the sender really belongs to the thread.
    socket.on('typing', (raw: unknown) => {
      void (async () => {
        const data = raw as { conversationId?: string; isTyping?: boolean };
        if (!data?.conversationId) return;
        const ids = await getParticipantIds(data.conversationId, Date.now());
        if (!ids.includes(userId)) return; // not a participant - ignore
        for (const uid of ids) {
          if (uid === userId) continue;
          emitToUser(uid, 'typing', {
            conversationId: data.conversationId,
            userId,
            isTyping: Boolean(data.isTyping),
          });
        }
      })().catch(() => undefined);
    });

    // ---- Delivery ack -----------------------------------------------------
    // When a recipient's client receives a message it acks; we relay a
    // `message:delivered` to whoever else is in the thread (the sender) so
    // their sent bubble can flip to a double-tick.
    socket.on('message:ack', (raw: unknown) => {
      void (async () => {
        const data = raw as { conversationId?: string; messageId?: string };
        if (!data?.conversationId || !data?.messageId) return;
        const ids = await getParticipantIds(data.conversationId, Date.now());
        if (!ids.includes(userId)) return;
        for (const uid of ids) {
          if (uid === userId) continue;
          emitToUser(uid, 'message:delivered', {
            conversationId: data.conversationId,
            messageId: data.messageId,
          });
        }
      })().catch(() => undefined);
    });
  });
}
