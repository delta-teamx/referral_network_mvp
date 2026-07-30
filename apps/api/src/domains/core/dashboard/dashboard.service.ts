import { prisma } from '../../../config/prisma.js';
import { pipelineStats, syncPipeline } from '../../network/pipeline/pipeline.service.js';

/**
 * Dashboard - aggregate read-only queries for a business owner's home page.
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

  // Pull real activity into the pipeline first so its stage counts are fresh.
  await syncPipeline(userId).catch(() => undefined);

  const [leads, referrals, reviews, messages, bookings, intros, pipeline, wonCards] = await Promise.all([
    prisma.consumerLead.findMany({
      where: { listing: { userId, deletedAt: null }, createdAt: { gte: since } },
      select: { createdAt: true, status: true, convertedAt: true },
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
    // Intro requests involving me (sent or received).
    prisma.introduction.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: ['requested', 'accepted'] },
        OR: [{ senderId: userId }, { targetId: userId }],
      },
      select: { createdAt: true },
    }),
    pipelineStats(userId).catch(() => null),
    // Deals won per week (by the time the card was moved to won).
    prisma.pipelineCard.findMany({
      where: { ownerId: userId, stage: 'won', stageUpdatedAt: { gte: since } },
      select: { stageUpdatedAt: true },
    }).catch(() => [] as Array<{ stageUpdatedAt: Date }>),
  ]);

  // Ratings RECEIVED from call peers (host is rated by guestRating and vice
  // versa) - combined with listing reviews below.
  const ratedCalls = await prisma.bookingCall
    .findMany({
      where: {
        OR: [{ hostId: userId }, { guestId: userId }],
        status: { in: ['confirmed', 'completed'] },
      },
      select: { hostId: true, hostRating: true, guestRating: true },
    })
    .catch(() => [] as Array<{ hostId: string; hostRating: number | null; guestRating: number | null }>);
  const callRatingsReceived = ratedCalls
    .map((b) => (b.hostId === userId ? b.guestRating : b.hostRating))
    .filter((r): r is number => typeof r === 'number');

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
      // Converted series bucket by WHEN they converted (convertedAt), not when
      // the lead/referral was first created - otherwise a conversion shows up
      // in the wrong week.
      leadsConverted: bucketize(
        leads
          .filter((l) => l.status === 'CONVERTED' && l.convertedAt)
          .map((l) => ({ createdAt: l.convertedAt as Date })),
      ),
      referrals: bucketize(referrals),
      referralsConverted: bucketize(
        referrals
          .filter((r) => r.status === 'CONVERTED' && r.convertedAt)
          .map((r) => ({ createdAt: r.convertedAt as Date })),
      ),
      reviews: bucketize(reviews),
      messages: bucketize(messages),
      bookings: bucketize(bookings),
      intros: bucketize(intros),
      won: bucketize(
        wonCards.map((w) => ({ createdAt: w.stageUpdatedAt })),
      ),
    },
    pipeline,
    ratings: (() => {
      const all = [...reviews.map((r) => r.rating), ...callRatingsReceived];
      return {
        avg: all.length === 0 ? 0 : all.reduce((a, r) => a + r, 0) / all.length,
        count: all.length,
        distribution: [1, 2, 3, 4, 5].map((star) => ({
          star,
          count: all.filter((r) => r === star).length,
        })),
      };
    })(),
  };
}

export async function getOwnerMetrics(userId: string) {
  const [listings, leadCounts, referralCounts, viewCount, avgListing, introRequests, callsBooked, messagesCount] = await Promise.all([
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
    prisma.introduction.count({
      where: { targetId: userId, status: { in: ['requested', 'accepted'] } },
    }),
    prisma.bookingCall.count({
      where: {
        OR: [{ hostId: userId }, { guestId: userId }],
        status: { in: ['pending', 'confirmed', 'completed'] },
      },
    }),
    prisma.message.count({
      where: { conversation: { participants: { some: { userId } } } },
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
      introRequests,
      callsBooked,
      messages: messagesCount,
      avgRating: Number(avgListing._avg.avgRating ?? 0),
      avgTrustScore: Number(avgListing._avg.trustScore ?? 0),
    },
    leadsByStatus,
    referralsByStatus,
  };
}
