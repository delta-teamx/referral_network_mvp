import crypto from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { requestConnection } from '../connections/connections.service.js';

/**
 * BusinessInvitation — a business owner invites a peer (by email) to join
 * the network. On accept, the new user is auto-connected to the sender,
 * turning every invite into a seeded BusinessConnection. Drives viral growth.
 *
 * Status lifecycle:
 *   pending → accepted (on signup/accept)
 *          \→ revoked (sender cancels)
 *          \→ expired (14 days, checked lazily on read)
 */

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

const INVITATION_TTL_DAYS = 14;

export interface InvitationView {
  id: string;
  recipientEmail: string;
  message: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
  token: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
}

export interface InvitationPublicView {
  id: string;
  recipientEmail: string;
  message: string | null;
  expiresAt: Date;
  status: InvitationStatus;
  sender: {
    firstName: string;
    lastName: string;
    listing: { name: string; slug: string; city: string; state: string } | null;
  };
}

const invitationSelect = {
  id: true,
  recipientEmail: true,
  message: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  token: true,
  sender: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

function normaliseStatus(row: { status: string; expiresAt: Date }): InvitationStatus {
  if (row.status === 'pending' && row.expiresAt < new Date()) return 'expired';
  return row.status as InvitationStatus;
}

/**
 * Send an invitation. Generates a cryptographic token and sets a 14-day expiry.
 * Idempotent-ish: resending to the same email revokes the previous pending
 * invite first so the recipient's most recent link is the one that works.
 */
export async function sendInvitation(
  senderId: string,
  recipientEmail: string,
  message?: string,
): Promise<InvitationView> {
  const normalisedEmail = recipientEmail.trim().toLowerCase();
  if (!normalisedEmail) throw AppError.badRequest('Recipient email is required');

  const sender = await prisma.user.findFirst({
    where: { id: senderId, deletedAt: null },
    select: { email: true },
  });
  if (!sender) throw AppError.notFound('Sender not found');
  if (sender.email.toLowerCase() === normalisedEmail) {
    throw AppError.badRequest("You can't invite yourself.");
  }

  // If the invitee already has an account, auto-convert to a connection
  // request and skip the email token dance.
  const existingUser = await prisma.user.findFirst({
    where: { email: normalisedEmail, deletedAt: null },
    select: { id: true },
  });
  if (existingUser) {
    await requestConnection(senderId, existingUser.id);
    // Still create the invitation row for audit; mark it auto-accepted.
    const row = await prisma.businessInvitation.create({
      data: {
        senderId,
        recipientEmail: normalisedEmail,
        recipientUserId: existingUser.id,
        message: message?.trim() || null,
        token: crypto.randomBytes(24).toString('hex'),
        status: 'accepted',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86400_000),
      },
      select: invitationSelect,
    });
    return { ...row, status: 'accepted' };
  }

  // Revoke any prior pending invite to this email from this sender
  await prisma.businessInvitation.updateMany({
    where: { senderId, recipientEmail: normalisedEmail, status: 'pending' },
    data: { status: 'revoked' },
  });

  const created = await prisma.businessInvitation.create({
    data: {
      senderId,
      recipientEmail: normalisedEmail,
      message: message?.trim() || null,
      token: crypto.randomBytes(24).toString('hex'),
      status: 'pending',
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86400_000),
    },
    select: invitationSelect,
  });

  await eventBus.publish('business_invitation.sent', {
    invitationId: created.id,
    recipientEmail: normalisedEmail,
  });

  return { ...created, status: normaliseStatus(created) };
}

/**
 * Public (no auth) lookup of an invitation by token. Powers the landing page
 * where the recipient sees who invited them before accepting.
 */
export async function getInvitationByToken(token: string): Promise<InvitationPublicView> {
  const row = await prisma.businessInvitation.findUnique({
    where: { token },
    select: {
      id: true,
      recipientEmail: true,
      message: true,
      status: true,
      expiresAt: true,
      sender: {
        select: {
          firstName: true,
          lastName: true,
          listings: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { name: true, slug: true, city: true, state: true },
          },
        },
      },
    },
  });
  if (!row) throw AppError.notFound('Invitation not found');

  return {
    id: row.id,
    recipientEmail: row.recipientEmail,
    message: row.message,
    expiresAt: row.expiresAt,
    status: normaliseStatus(row),
    sender: {
      firstName: row.sender.firstName,
      lastName: row.sender.lastName,
      listing: row.sender.listings[0] ?? null,
    },
  };
}

/**
 * Accept an invitation. Requires an authenticated user — typically called
 * right after the recipient signs up. Marks the invitation accepted and
 * creates a mutual BusinessConnection (through requestConnection which
 * we then flip to accepted).
 */
export async function acceptInvitation(token: string, acceptingUserId: string): Promise<{
  connectionId: string;
  invitationId: string;
}> {
  const row = await prisma.businessInvitation.findUnique({
    where: { token },
    select: { id: true, senderId: true, status: true, expiresAt: true },
  });
  if (!row) throw AppError.notFound('Invitation not found');
  const effective = normaliseStatus(row);
  if (effective !== 'pending') {
    throw AppError.badRequest(`Invitation is ${effective}`);
  }
  if (row.senderId === acceptingUserId) {
    throw AppError.badRequest("You can't accept your own invitation.");
  }

  // Create or revive the connection, then mark it accepted immediately.
  const conn = await requestConnection(row.senderId, acceptingUserId);
  if (conn.status !== 'accepted') {
    await prisma.businessConnection.update({
      where: { id: conn.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    await eventBus.publish('business_connection.accepted', { connectionId: conn.id });
  }

  await prisma.businessInvitation.update({
    where: { id: row.id },
    data: {
      status: 'accepted',
      acceptedAt: new Date(),
      recipientUserId: acceptingUserId,
    },
  });

  await eventBus.publish('business_invitation.accepted', {
    invitationId: row.id,
    newUserId: acceptingUserId,
  });

  return { connectionId: conn.id, invitationId: row.id };
}

export async function listSentInvitations(senderId: string): Promise<InvitationView[]> {
  const rows = await prisma.businessInvitation.findMany({
    where: { senderId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: invitationSelect,
  });
  return rows.map((r) => ({ ...r, status: normaliseStatus(r) }));
}

export async function revokeInvitation(id: string, senderId: string): Promise<InvitationView> {
  const row = await prisma.businessInvitation.findFirst({
    where: { id, senderId, status: 'pending' },
    select: { id: true },
  });
  if (!row) throw AppError.notFound('Pending invitation not found');
  const updated = await prisma.businessInvitation.update({
    where: { id: row.id },
    data: { status: 'revoked' },
    select: invitationSelect,
  });
  return { ...updated, status: 'revoked' };
}
