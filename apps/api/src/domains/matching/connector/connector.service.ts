import type { EventType } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';
import { eventBus } from '../../core/events/index.js';

/**
 * Life-events connector — turn an EventType + ZIP into a ranked list of
 * local pros. Branch 2/3 implementation uses straightforward SQL joins
 * and a weighted-score formula; Branch 5 swaps the inline scorer for
 * the pluggable `RankingStrategy` under `domains/matching/ranking/`.
 */

export interface MatchRequest {
  eventType: EventType;
  zip: string;
  /** ZIP prefix length used for "nearby" (3 = ~metro area). */
  radiusPrefix?: number;
  limit?: number;
}

export interface MatchedListing {
  listingId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  city: string;
  state: string;
  categoryName: string;
  categorySlug: string;
  avgRating: number;
  reviewCount: number;
  trustScore: number;
  isVerified: boolean;
  score: number;
  scoreBreakdown: {
    relevance: number;
    trust: number;
    rating: number;
    verifiedBonus: number;
  };
}

export async function match(req: MatchRequest): Promise<MatchedListing[]> {
  const limit = Math.min(20, Math.max(3, req.limit ?? 10));
  const prefix = req.zip.slice(0, req.radiusPrefix ?? 3);

  // Categories that matter for this life event, with their relevance weight.
  const mapping = await prisma.eventCategoryMap.findMany({
    where: { eventType: req.eventType },
    select: { categoryId: true, relevance: true },
  });

  if (mapping.length === 0) return [];

  const relevanceById = new Map(mapping.map((m) => [m.categoryId, m.relevance]));

  const candidates = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      categoryId: { in: mapping.map((m) => m.categoryId) },
      zipCode: { startsWith: prefix },
    },
    take: 40, // over-fetch; we re-rank below
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      city: true,
      state: true,
      categoryId: true,
      avgRating: true,
      reviewCount: true,
      trustScore: true,
      isVerified: true,
      category: { select: { name: true, slug: true } },
    },
  });

  const ranked: MatchedListing[] = candidates
    .map((c) => {
      const relevance = relevanceById.get(c.categoryId) ?? 1;
      const trust = Number(c.trustScore);
      const rating = Number(c.avgRating);
      const verifiedBonus = c.isVerified ? 5 : 0;
      const score = relevance * 3 + trust * 2 + rating * 1.5 + verifiedBonus;
      return {
        listingId: c.id,
        slug: c.slug,
        name: c.name,
        shortDescription: c.shortDescription,
        city: c.city,
        state: c.state,
        categoryName: c.category.name,
        categorySlug: c.category.slug,
        avgRating: rating,
        reviewCount: c.reviewCount,
        trustScore: trust,
        isVerified: c.isVerified,
        score,
        scoreBreakdown: {
          relevance: relevance * 3,
          trust: trust * 2,
          rating: rating * 1.5,
          verifiedBonus,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  await eventBus.publish('matching.completed', {
    requestId: crypto.randomUUID(),
    eventType: req.eventType,
    resultCount: ranked.length,
  });

  return ranked;
}
