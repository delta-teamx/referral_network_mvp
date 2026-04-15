import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

/**
 * B2B referrals — one business owner sending a client to another business.
 * Distinct from ConsumerLead (consumer→business via the life-events
 * connector) and BusinessConnection (durable owner↔owner relationship).
 *
 * Status lifecycle:
 *   SENT → ACCEPTED → CONVERTED
 *          \→ DECLINED
 */

export type ReferralStatus = 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'DECLINED';

export interface CreateReferralInput {
  senderId: string;
  listingSlug: string; // the receiving business
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
}

export async function sendReferral(input: CreateReferralInput) {
  const listing = await prisma.listing.findFirst({
    where: { slug: input.listingSlug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, userId: true, name: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');
  if (listing.userId === input.senderId) {
    throw AppError.badRequest("You can't refer a client to yourself.");
  }

  const referral = await prisma.referral.create({
    data: {
      senderId: input.senderId,
      receiverId: listing.userId,
      listingId: listing.id,
      clientName: input.clientName?.trim() || null,
      clientPhone: input.clientPhone?.trim() || null,
      clientEmail: input.clientEmail?.trim() || null,
      notes: input.notes?.trim() || null,
    },
    select: referralSelect,
  });

  await eventBus.publish('referral.sent', {
    referralId: referral.id,
    senderId: input.senderId,
    receiverId: listing.userId,
  });

  return referral;
}

export async function listReferralsSent(userId: string) {
  return prisma.referral.findMany({
    where: { senderId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: referralSelect,
  });
}

export async function listReferralsReceived(userId: string) {
  return prisma.referral.findMany({
    where: { receiverId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: referralSelect,
  });
}

export async function updateReferralStatus(
  referralId: string,
  userId: string,
  status: ReferralStatus,
) {
  const referral = await prisma.referral.findFirst({
    where: { id: referralId, receiverId: userId },
    select: { id: true, status: true },
  });
  if (!referral) throw AppError.notFound('Referral not found');

  const data: {
    status: ReferralStatus;
    convertedAt?: Date;
  } = { status };
  if (status === 'CONVERTED') data.convertedAt = new Date();

  const updated = await prisma.referral.update({
    where: { id: referralId },
    data,
    select: referralSelect,
  });

  if (status === 'ACCEPTED') await eventBus.publish('referral.accepted', { referralId });
  if (status === 'CONVERTED') await eventBus.publish('referral.converted', { referralId });
  if (status === 'DECLINED') await eventBus.publish('referral.declined', { referralId });

  return updated;
}

const referralSelect = {
  id: true,
  status: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  notes: true,
  convertedAt: true,
  createdAt: true,
  sender: { select: { id: true, firstName: true, lastName: true, email: true } },
  receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
  listing: { select: { id: true, slug: true, name: true, city: true, state: true } },
} as const;
