import type { EventType } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

/**
 * Consumer leads — created when a consumer clicks "Connect" on a matched
 * listing (from /connect/[event]) or "Request a quote" (from /listing/[slug]).
 *
 * Creation publishes `consumer_lead.created` which the notifications
 * subscriber uses to dispatch email/SMS to the business owner.
 */

export interface CreateLeadInput {
  consumerId: string;
  listingId: string;
  eventType: EventType;
  notes?: string;
}

export async function createLead(input: CreateLeadInput) {
  const listing = await prisma.listing.findFirst({
    where: { id: input.listingId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const lead = await prisma.consumerLead.create({
    data: {
      consumerId: input.consumerId,
      listingId: listing.id,
      eventType: input.eventType,
      notes: input.notes ?? null,
    },
    select: {
      id: true,
      status: true,
      eventType: true,
      createdAt: true,
      listing: { select: { slug: true, name: true } },
    },
  });

  await eventBus.publish('consumer_lead.created', {
    leadId: lead.id,
    listingId: listing.id,
    eventType: input.eventType,
  });

  return lead;
}

export async function listConsumerLeadsForOwner(userId: string, opts?: { status?: string }) {
  return prisma.consumerLead.findMany({
    where: {
      listing: { userId, deletedAt: null },
      ...(opts?.status
        ? { status: opts.status as 'PENDING' | 'CONTACTED' | 'CONVERTED' | 'EXPIRED' }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      eventType: true,
      notes: true,
      contactedAt: true,
      convertedAt: true,
      createdAt: true,
      consumer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      listing: { select: { id: true, slug: true, name: true } },
    },
  });
}

export async function listConsumerLeadsForConsumer(consumerId: string) {
  return prisma.consumerLead.findMany({
    where: { consumerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      eventType: true,
      createdAt: true,
      contactedAt: true,
      convertedAt: true,
      listing: {
        select: {
          slug: true,
          name: true,
          city: true,
          state: true,
          category: { select: { name: true } },
        },
      },
    },
  });
}

export async function updateLeadStatus(
  leadId: string,
  ownerId: string,
  status: 'PENDING' | 'CONTACTED' | 'CONVERTED' | 'EXPIRED',
) {
  const lead = await prisma.consumerLead.findFirst({
    where: { id: leadId, listing: { userId: ownerId } },
    select: { id: true },
  });
  if (!lead) throw AppError.notFound('Lead not found');

  const data: {
    status: typeof status;
    contactedAt?: Date;
    convertedAt?: Date;
  } = { status };
  if (status === 'CONTACTED') data.contactedAt = new Date();
  if (status === 'CONVERTED') data.convertedAt = new Date();

  const updated = await prisma.consumerLead.update({
    where: { id: leadId },
    data,
  });

  if (status === 'CONTACTED') {
    await eventBus.publish('consumer_lead.contacted', { leadId });
  }
  if (status === 'CONVERTED') {
    await eventBus.publish('consumer_lead.converted', { leadId });
  }

  return updated;
}
