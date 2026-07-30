import { prisma } from '../../../config/prisma.js';

/**
 * Trust-score recompute job.
 *
 * Formula (0-100):
 *   reviews:      avg rating (0-5) normalised to 0-40 + log(count) bonus to +10
 *   conversions:  converted-referral fraction (0-1) scaled to 0-20
 *   verified:     +10 if owner has verified email/listing
 *   network:      up to +10 for accepted BusinessConnections, log-scaled
 *   activity:     up to +10 for a fresh listing edit in the last 30 days
 *
 * The number is a signal, not a security boundary. It's surfaced on listing
 * cards and fed into RankingStrategy.trustScore. Recomputed by the scheduler
 * daily, and on demand after any event that could move it (new review,
 * converted lead, new connection).
 */

export async function recomputeTrustForListing(listingId: string): Promise<number> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      userId: true,
      isVerified: true,
      updatedAt: true,
      avgRating: true,
      reviewCount: true,
    },
  });
  if (!listing) return 0;

  const rating = Number(listing.avgRating);
  const ratingScore = (rating / 5) * 40;
  const reviewBonus = Math.min(10, Math.log1p(listing.reviewCount) * 2);

  const [convertedLeads, totalLeads] = await Promise.all([
    prisma.consumerLead.count({
      where: { listing: { userId: listing.userId }, status: 'CONVERTED' },
    }),
    prisma.consumerLead.count({
      where: { listing: { userId: listing.userId } },
    }),
  ]);
  const convRate = totalLeads === 0 ? 0 : convertedLeads / totalLeads;
  const conversionScore = convRate * 20;

  const verifiedScore = listing.isVerified ? 10 : 0;

  const acceptedConnections = await prisma.businessConnection.count({
    where: {
      status: 'accepted',
      OR: [{ initiatorId: listing.userId }, { targetId: listing.userId }],
    },
  });
  const networkScore = Math.min(10, Math.log1p(acceptedConnections) * 3);

  // Freshness must come from a signal the recompute does NOT itself mutate.
  // Using listing.updatedAt was self-perpetuating: writing trustScore below
  // bumps @updatedAt, so every nightly run reset "days since edit" to ~0 and
  // every listing permanently earned the full activity bonus. Base it on the
  // latest genuine engagement (most recent review) instead.
  const latestReview = await prisma.review.findFirst({
    where: { listingId: listing.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const daysSinceActivity = latestReview
    ? (Date.now() - latestReview.createdAt.getTime()) / 86400_000
    : 90; // no reviews yet → no activity bonus (rather than a free +10)
  const activityScore = Math.max(0, 10 - daysSinceActivity / 3);

  const raw =
    ratingScore + reviewBonus + conversionScore + verifiedScore + networkScore + activityScore;
  // Column is Decimal(3,1) → max 99.9; clamping at 100 overflowed and threw on
  // a perfect score, failing the whole recompute.
  const clamped = Math.max(0, Math.min(99.9, Math.round(raw * 10) / 10));

  await prisma.listing.update({
    where: { id: listing.id },
    data: { trustScore: clamped },
  });
  return clamped;
}

/**
 * Recompute trust for every active listing. Intentionally simple: iterate
 * sequentially, log per-batch progress. With ~10k listings this runs in
 * single-digit seconds; when we outgrow that, parallelise via BullMQ fanout.
 */
export async function recomputeAllTrustScores(): Promise<{ updated: number; ms: number }> {
  const start = Date.now();
  const listings = await prisma.listing.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  for (const l of listings) {
    await recomputeTrustForListing(l.id);
  }
  return { updated: listings.length, ms: Date.now() - start };
}
