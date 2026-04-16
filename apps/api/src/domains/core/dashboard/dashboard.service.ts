import { prisma } from '../../../config/prisma.js';

/**
 * Dashboard — aggregate read-only queries for a business owner's home page.
 * Cheap enough to compute on request for Branch 2 volumes; move to
 * materialised views / event-sourced aggregates in Branch 7.
 */
export async function getOwnerMetrics(userId: string) {
  const [listings, leadCounts, referralCounts, viewCount, avgListing] = await Promise.all([
    prisma.listing.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        avgRating: true,
        reviewCount: true,
        trustScore: true,
        viewCount: true,
        isVerified: true,
        status: true,
      },
    }),
    prisma.consumerLead.groupBy({
      by: ['status'],
      where: { listing: { userId, deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.referral.groupBy({
      by: ['status'],
      where: { receiverId: userId },
      _count: { _all: true },
    }),
    prisma.listing.aggregate({
      where: { userId, deletedAt: null },
      _sum: { viewCount: true },
    }),
    prisma.listing.aggregate({
      where: { userId, deletedAt: null },
      _avg: { avgRating: true, trustScore: true },
    }),
  ]);

  const leadsByStatus = Object.fromEntries(
    leadCounts.map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;
  const referralsByStatus = Object.fromEntries(
    referralCounts.map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;

  return {
    listings,
    totals: {
      listings: listings.length,
      views: viewCount._sum.viewCount ?? 0,
      leadsTotal: Object.values(leadsByStatus).reduce((a, b) => a + b, 0),
      leadsPending: leadsByStatus.PENDING ?? 0,
      leadsContacted: leadsByStatus.CONTACTED ?? 0,
      leadsConverted: leadsByStatus.CONVERTED ?? 0,
      referralsReceived: Object.values(referralsByStatus).reduce((a, b) => a + b, 0),
      referralsConverted: referralsByStatus.CONVERTED ?? 0,
      avgRating: Number(avgListing._avg.avgRating ?? 0),
      avgTrustScore: Number(avgListing._avg.trustScore ?? 0),
    },
    leadsByStatus,
    referralsByStatus,
  };
}
