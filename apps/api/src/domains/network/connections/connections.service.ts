import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

/**
 * BusinessConnection — the peer-to-peer relationship between two business
 * owners. This is distinct from:
 *   - Referral: a single client handoff (one-time event)
 *   - ConsumerLead: a consumer asking the network for help
 *
 * A connection is symmetric once accepted: both users see each other as
 * "in my network." Used for referral targeting, group formation, and
 * relationship-strength scoring.
 *
 * Status lifecycle:
 *   pending → accepted
 *          \→ declined
 *          \→ archived (soft-delete after accepted)
 */

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'archived';

export interface ConnectionView {
  id: string;
  status: ConnectionStatus;
  direction: 'outbound' | 'inbound';
  strengthScore: string;
  createdAt: Date;
  acceptedAt: Date | null;
  lastInteractAt: Date | null;
  peer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

const connectionSelect = {
  id: true,
  status: true,
  strengthScore: true,
  createdAt: true,
  acceptedAt: true,
  lastInteractAt: true,
  initiatorId: true,
  targetId: true,
  initiator: {
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
  },
  target: {
    select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
  },
} as const;

function toView(
  row: {
    id: string;
    status: string;
    strengthScore: { toString(): string };
    createdAt: Date;
    acceptedAt: Date | null;
    lastInteractAt: Date | null;
    initiatorId: string;
    targetId: string;
    initiator: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl: string | null;
    };
    target: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl: string | null;
    };
  },
  viewerId: string,
): ConnectionView {
  const isInitiator = row.initiatorId === viewerId;
  return {
    id: row.id,
    status: row.status as ConnectionStatus,
    direction: isInitiator ? 'outbound' : 'inbound',
    strengthScore: row.strengthScore.toString(),
    createdAt: row.createdAt,
    acceptedAt: row.acceptedAt,
    lastInteractAt: row.lastInteractAt,
    peer: isInitiator ? row.target : row.initiator,
  };
}

/**
 * Create a pending connection request. Idempotent: if a connection already
 * exists in either direction, return it. Re-raises declined/archived so the
 * user knows to ask again.
 */
export async function requestConnection(
  initiatorId: string,
  targetId: string,
): Promise<ConnectionView> {
  if (initiatorId === targetId) {
    throw AppError.badRequest("You can't connect with yourself.");
  }

  const existing = await prisma.businessConnection.findFirst({
    where: {
      OR: [
        { initiatorId, targetId },
        { initiatorId: targetId, targetId: initiatorId },
      ],
    },
    select: connectionSelect,
  });

  if (existing) {
    if (existing.status === 'accepted' || existing.status === 'pending') {
      return toView(existing, initiatorId);
    }
    // declined / archived → reset to pending
    const revived = await prisma.businessConnection.update({
      where: { id: existing.id },
      data: {
        status: 'pending',
        initiatorId,
        targetId,
        acceptedAt: null,
      },
      select: connectionSelect,
    });
    await eventBus.publish('business_connection.requested', {
      connectionId: revived.id,
      initiatorId,
      targetId,
    });
    return toView(revived, initiatorId);
  }

  const target = await prisma.user.findFirst({
    where: { id: targetId, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw AppError.notFound('Target user not found');

  const created = await prisma.businessConnection.create({
    data: { initiatorId, targetId, status: 'pending' },
    select: connectionSelect,
  });

  await eventBus.publish('business_connection.requested', {
    connectionId: created.id,
    initiatorId,
    targetId,
  });

  return toView(created, initiatorId);
}

/**
 * Respond to an incoming pending connection. Only the target can respond.
 */
export async function respondToConnection(
  connectionId: string,
  userId: string,
  action: 'accept' | 'decline',
): Promise<ConnectionView> {
  const row = await prisma.businessConnection.findFirst({
    where: { id: connectionId, targetId: userId, status: 'pending' },
    select: { id: true },
  });
  if (!row) throw AppError.notFound('Pending connection not found');

  const updated = await prisma.businessConnection.update({
    where: { id: row.id },
    data: {
      status: action === 'accept' ? 'accepted' : 'declined',
      acceptedAt: action === 'accept' ? new Date() : null,
      lastInteractAt: new Date(),
    },
    select: connectionSelect,
  });

  if (action === 'accept') {
    await eventBus.publish('business_connection.accepted', { connectionId: updated.id });
  } else {
    await eventBus.publish('business_connection.declined', { connectionId: updated.id });
  }

  return toView(updated, userId);
}

/**
 * List all connections for a user, filterable by status. Returns both
 * outbound (I requested) and inbound (they requested me) with a direction
 * flag so the UI can render accept/decline only for inbound-pending rows.
 */
export async function listConnections(
  userId: string,
  status?: ConnectionStatus,
): Promise<ConnectionView[]> {
  const rows = await prisma.businessConnection.findMany({
    where: {
      OR: [{ initiatorId: userId }, { targetId: userId }],
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: connectionSelect,
  });
  return rows.map((r) => toView(r, userId));
}

/**
 * Archive a connection. Either party can do this.
 */
export async function archiveConnection(
  connectionId: string,
  userId: string,
): Promise<ConnectionView> {
  const row = await prisma.businessConnection.findFirst({
    where: {
      id: connectionId,
      OR: [{ initiatorId: userId }, { targetId: userId }],
    },
    select: { id: true },
  });
  if (!row) throw AppError.notFound('Connection not found');

  const updated = await prisma.businessConnection.update({
    where: { id: row.id },
    data: { status: 'archived' },
    select: connectionSelect,
  });
  return toView(updated, userId);
}

/**
 * Quick check: is there an accepted connection between two users? Used by
 * the listing page to decide whether to show "Connect" vs "Refer a client."
 */
export async function getConnectionState(
  viewerId: string,
  otherId: string,
): Promise<'none' | 'pending_outbound' | 'pending_inbound' | 'accepted' | 'declined'> {
  if (viewerId === otherId) return 'none';
  const row = await prisma.businessConnection.findFirst({
    where: {
      OR: [
        { initiatorId: viewerId, targetId: otherId },
        { initiatorId: otherId, targetId: viewerId },
      ],
    },
    select: { status: true, initiatorId: true },
  });
  if (!row) return 'none';
  if (row.status === 'accepted') return 'accepted';
  if (row.status === 'pending') {
    return row.initiatorId === viewerId ? 'pending_outbound' : 'pending_inbound';
  }
  if (row.status === 'declined') return 'declined';
  return 'none';
}
