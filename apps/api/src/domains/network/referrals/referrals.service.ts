import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../../core/notifications/notifications.service.js';
import { awardContribution, reconcileReferralAwards } from '../referral-tracking/contribution.service.js';

/** Recipient's verdict on a received referral (drives the Contribution Score). */
export type ReferralVerdict = 'relevant' | 'opportunity' | 'not_relevant';

/**
 * B2B referrals - one business owner sending a client to another business.
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
  /** Refer to a directory listing… */
  listingSlug?: string;
  /** …or directly to a member (member-to-member referral). */
  receiverUserId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  notes?: string;
}

export async function sendReferral(input: CreateReferralInput) {
  let receiverId: string;
  let listingId: string | null = null;

  if (input.listingSlug) {
    const listing = await prisma.listing.findFirst({
      where: { slug: input.listingSlug, status: 'ACTIVE', deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!listing) throw AppError.notFound('Listing not found');
    receiverId = listing.userId;
    listingId = listing.id;
  } else if (input.receiverUserId) {
    const receiver = await prisma.user.findFirst({
      where: { id: input.receiverUserId, deletedAt: null },
      select: { id: true },
    });
    if (!receiver) throw AppError.notFound('Member not found');
    receiverId = receiver.id;
  } else {
    throw AppError.badRequest('Provide a member or a listing to refer to.');
  }

  if (receiverId === input.senderId) {
    throw AppError.badRequest("You can't refer a client to yourself.");
  }

  const referral = await prisma.referral.create({
    data: {
      senderId: input.senderId,
      receiverId,
      listingId,
      clientName: input.clientName ? sanitizeText(input.clientName) || null : null,
      clientPhone: input.clientPhone?.trim() || null,
      clientEmail: input.clientEmail?.trim().toLowerCase() || null,
      notes: input.notes ? sanitizeText(input.notes) || null : null,
    },
    select: referralSelect,
  });

  await eventBus.publish('referral.sent', {
    referralId: referral.id,
    senderId: input.senderId,
    receiverId,
  });

  // Alert the receiver in the notification bell (best-effort; email is sent
  // by the referral.sent subscriber).
  void createNotification({
    userId: receiverId,
    type: 'referral',
    title: 'New client referral 🎉',
    body: `You received a referral${input.clientName ? ` for ${sanitizeText(input.clientName)}` : ''} - view it in your Referrals tab.`,
    data: { referralId: referral.id },
  }).catch(() => undefined);

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

  if (status === 'ACCEPTED') {
    await eventBus.publish('referral.accepted', { referralId });
    await awardContribution(`referral_accepted:${referralId}`, updated.sender.id, 'referral_accepted', new Date());
  }
  if (status === 'CONVERTED') {
    await eventBus.publish('referral.converted', { referralId });
    // Completed business is the top Contribution Score award (recipient-verified).
    await awardContribution(`referral_business:${referralId}`, updated.sender.id, 'referral_business', new Date());
  }
  if (status === 'DECLINED') await eventBus.publish('referral.declined', { referralId });

  return updated;
}

/**
 * Recipient confirms whether a received referral was relevant and valuable.
 * This is the Contribution Score gate: the SENDER only earns referral points
 * once the recipient verifies quality. "opportunity" means it may become a
 * qualified opportunity, which earns the higher award.
 */
export async function verifyReferral(
  referralId: string,
  receiverUserId: string,
  verdict: ReferralVerdict,
) {
  const referral = await prisma.referral.findFirst({
    where: { id: referralId, receiverId: receiverUserId },
    select: { id: true, senderId: true, status: true, relevance: true, clientName: true },
  });
  if (!referral) throw AppError.notFound('Referral not found');

  const now = new Date();
  const nextStatus: ReferralStatus =
    verdict === 'not_relevant'
      ? 'DECLINED'
      : referral.status === 'SENT'
        ? 'ACCEPTED'
        : referral.status;

  const updated = await prisma.referral.update({
    where: { id: referralId },
    data: { relevance: verdict, relevanceAt: now, status: nextStatus },
    select: referralSelect,
  });

  // Award the SENDER, gated on the recipient's verification. Reconciles to the
  // current verdict, so downgrading (opportunity -> relevant -> not relevant)
  // claws the extra points back; "not relevant" leaves nothing.
  await reconcileReferralAwards(referralId, referral.senderId, verdict, now);

  // Let the sender know their referral was verified (best-effort).
  const label =
    verdict === 'opportunity'
      ? 'may become an opportunity 🚀'
      : verdict === 'relevant'
        ? 'was a great match ✅'
        : 'was marked not relevant';
  void createNotification({
    userId: referral.senderId,
    type: 'referral',
    title: 'Your referral was reviewed',
    body: `Your referral${referral.clientName ? ` for ${referral.clientName}` : ''} ${label}.`,
    data: { referralId },
  }).catch(() => undefined);

  return updated;
}

/** Admin: referrals a recipient marked "not relevant" (for dispute review). */
export async function listDisputedReferrals() {
  return prisma.referral.findMany({
    where: { relevance: 'not_relevant' },
    orderBy: { relevanceAt: 'desc' },
    take: 100,
    select: referralSelect,
  });
}

/**
 * Admin override of a referral verdict (dispute resolution). Bypasses the
 * recipient check and awards the sender accordingly. Idempotent awards.
 */
export async function adminOverrideReferral(referralId: string, verdict: ReferralVerdict) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    select: { id: true, senderId: true, status: true },
  });
  if (!referral) throw AppError.notFound('Referral not found');
  const now = new Date();
  const updated = await prisma.referral.update({
    where: { id: referralId },
    data: {
      relevance: verdict,
      relevanceAt: now,
      status: verdict === 'not_relevant' ? 'DECLINED' : referral.status === 'SENT' ? 'ACCEPTED' : referral.status,
    },
    select: referralSelect,
  });
  await reconcileReferralAwards(referralId, referral.senderId, verdict, now);
  return updated;
}

const referralSelect = {
  id: true,
  status: true,
  relevance: true,
  relevanceAt: true,
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
