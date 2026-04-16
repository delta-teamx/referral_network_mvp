import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';

/**
 * Reviews service — consumer reviews on listings.
 *
 * One review per (listingId, userId) — enforced by Prisma @@unique.
 * On create/update, recompute the listing's `avgRating` and `reviewCount`
 * inline so the card can render without a separate aggregate job. Branch 7
 * swaps this for an event-sourced recompute once the listings are
 * high-traffic.
 */

export interface CreateReviewInput {
  listingSlug: string;
  userId: string;
  rating: number;
  title?: string;
  text: string;
}

export async function createReview(input: CreateReviewInput) {
  const listing = await prisma.listing.findFirst({
    where: { slug: input.listingSlug, status: 'ACTIVE', deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');
  if (listing.userId === input.userId) {
    throw AppError.badRequest("You can't review your own listing.");
  }

  const existing = await prisma.review.findUnique({
    where: {
      listingId_userId: { listingId: listing.id, userId: input.userId },
    },
  });
  if (existing) throw AppError.conflict('You have already reviewed this listing.');

  const review = await prisma.review.create({
    data: {
      listingId: listing.id,
      userId: input.userId,
      rating: Math.round(input.rating),
      title: input.title?.trim() || null,
      text: input.text.trim(),
    },
    select: {
      id: true,
      rating: true,
      title: true,
      text: true,
      isVerified: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  await recomputeListingAggregates(listing.id);

  await eventBus.publish('review.created', {
    reviewId: review.id,
    listingId: listing.id,
    rating: review.rating,
  });

  return review;
}

async function recomputeListingAggregates(listingId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { listingId, status: 'active' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.listing.update({
    where: { id: listingId },
    data: {
      avgRating: agg._avg.rating ?? 0,
      reviewCount: agg._count._all,
    },
  });
}
