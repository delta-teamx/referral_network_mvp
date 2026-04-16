import type { EventBus } from '../events/EventBus.js';
import { prisma } from '../../../config/prisma.js';
import { recomputeTrustForListing } from './trust.service.js';

/**
 * On-event trust-score updates. Keeps listing cards fresh without waiting
 * for the daily scheduler. All handlers are fire-and-forget — if the DB is
 * slow we don't block the publisher; worst case the next daily run covers it.
 */

export function registerTrustSubscribers(eventBus: EventBus): void {
  eventBus.subscribe('review.created', async ({ listingId }) => {
    await safeRecompute(listingId);
  });

  eventBus.subscribe('consumer_lead.converted', async ({ leadId }) => {
    const lead = await prisma.consumerLead.findUnique({
      where: { id: leadId },
      select: { listingId: true },
    });
    if (lead) await safeRecompute(lead.listingId);
  });

  eventBus.subscribe('business_connection.accepted', async ({ connectionId }) => {
    const conn = await prisma.businessConnection.findUnique({
      where: { id: connectionId },
      select: { initiatorId: true, targetId: true },
    });
    if (!conn) return;
    const listings = await prisma.listing.findMany({
      where: { userId: { in: [conn.initiatorId, conn.targetId] }, deletedAt: null },
      select: { id: true },
    });
    for (const l of listings) await safeRecompute(l.id);
  });
}

async function safeRecompute(listingId: string): Promise<void> {
  try {
    await recomputeTrustForListing(listingId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[trust] recompute failed for ${listingId}:`, (err as Error).message);
  }
}
