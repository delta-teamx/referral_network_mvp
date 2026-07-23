import { prisma } from '../../../config/prisma.js';

/**
 * Dashboard — aggregate read-only queries for a business owner's home page.
 * Cheap enough to compute on request for Branch 2 volumes; move to
 * materialised views / event-sourced aggregates in Branch 7.
 */

const MS_PER_WEEK = 7 * 86400_000;

function weekBuckets(weeks: number): { start: Date; label: string }[] {
  const out: { start: Date; label: string }[] = [];
  const now = new Date();
  // Align to start of the current week (Sunday UTC).
  const alignedNow = new Date(now);
  alignedNow.setUTCHours(0, 0, 0, 0);
  alignedNow.setUTCDate(alignedNow.getUTCDate() - alignedNow.getUTCDay());
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(alignedNow.getTime() - i * MS_PER_WEEK);
    out.push({
      start,
      label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
    });
  }
  return out;
}

/**
 * 12-week time series for the dashboard charts: leads received, referrals
 * converted, reviews received. Counts rows per week bucket.
 */
export async function getAnalytics(userId: string) {
  const buckets = weekBuckets(12);
  const since = buckets[0]?.start ?? new Date(0);

  const [leads, referrals, reviews, messages, bookings] = await Promise.all([
    prisma.consumerLead.findMany({
      where: { listing: { userId, deletedAt: null }, createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    }),
    prisma.referral.findMany({
      where: { receiverId: userId, createdAt: { gte: since } },
      select: { createdAt: true, status: true, convertedAt: true },
    }),
    prisma.review.findMany({
      where: { listing: { userId, deletedAt: null }, createdAt: { gte: since } },
      select: { createdAt: true, rating: true },
    }),
    // Networking activity: messages in the member's conversations.
    prisma.message.findMany({
      where: {
        createdAt: { gte: since },
        conversation: { participants: { some: { userId } } },
      },
      select: { createdAt: true },
    }),
    // Calls as host or guest (pending + confirmed).
    prisma.bookingCall.findMany({
      where: {
        createdAt: { gte: since },
        OR: [{ hostId: userId }, { guestId: userId }],
        status: { in: ['pending', 'confirmed', 'completed'] },
      },
      select: { createdAt: true },
    }),
  ]);

  function bucketize<T extends { createdAt: Date }>(rows: T[], filter?: (r: T) => boolean) {
    const counts = buckets.map(() => 0);
    for (const row of rows) {
      if (filter && !filter(row)) continue;
      const idx = buckets.findIndex(
        (b, i) =>
          row.createdAt >= b.start &&
          (i === buckets.length - 1 || row.createdAt < buckets[i + 1]!.start),
      );
      if (idx >= 0) counts[idx]! += 1;
    }
    return counts;
  }

  return {
    labels: buckets.map((b) => b.label),
    series: {
      leads: bucketize(leads),
      leadsConverted: bucketize(leads, (l) => l.status === 'CONVERTED'),
      referrals: bucketize(referrals),
      referralsConverted: bucketize(referrals, (r) => r.status === 'CONVERTED'),
      reviews: bucketize(reviews),
      messages: bucketize(messages),
      bookings: bucketize(bookings),
    },
    ratings: {
      avg:
        reviews.length === 0
          ? 0
          : reviews.reduce((a, r) => a + r.rating, 0) / reviews.length,
      count: reviews.length,
      distribution: [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: reviews.filter((r) => r.rating === star).length,
      })),
    },
  };
}

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
