import type { EventType } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { eventBus } from '../../core/events/index.js';
import type { RankingCandidate } from '../ranking/RankingStrategy.js';
import { strategyByName } from '../ranking/registry.js';

/**
 * Life-events connector — turn an EventType + ZIP into a ranked list of
 * local pros. Delegates scoring to a pluggable `RankingStrategy` (see
 * `domains/matching/ranking/`). Default strategy is `life-event-match`;
 * override via `RANKING_STRATEGY` env var or per-request `strategy` field.
 */

export interface MatchRequest {
  eventType: EventType;
  zip: string;
  /** ZIP prefix length used for "nearby" (3 = ~metro area). */
  radiusPrefix?: number;
  limit?: number;
  /** Optional override of the ranking strategy name. */
  strategy?: string;
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
  isFeatured: boolean;
  score: number;
  scoreBreakdown: Record<string, number>;
  strategy: string;
}

export async function match(req: MatchRequest): Promise<MatchedListing[]> {
  const limit = Math.min(20, Math.max(3, req.limit ?? 10));
  const prefix = req.zip.slice(0, req.radiusPrefix ?? 3);

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
    take: 60,
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      city: true,
      state: true,
      zipCode: true,
      categoryId: true,
      avgRating: true,
      reviewCount: true,
      trustScore: true,
      isVerified: true,
      isFeatured: true,
      userId: true,
      category: { select: { name: true, slug: true } },
    },
  });

  if (candidates.length === 0) return [];

  // Enrich candidates with historical conversion rate (a Branch-5 signal
  // that wasn't available in Branch 4). Cheap: one count per candidate.
  const ownerIds = [...new Set(candidates.map((c) => c.userId))];
  const convRates = await conversionRatesFor(ownerIds);

  // Prefer the per-request strategy, fall back to env, then default.
  const strategy = strategyByName(
    req.strategy ?? (env.NODE_ENV === 'production' ? undefined : undefined),
  );

  const ranking = strategy.rank(
    candidates.map(
      (c): RankingCandidate => ({
        listingId: c.id,
        score: 0,
        trustScore: Number(c.trustScore),
        avgRating: Number(c.avgRating),
        reviewCount: c.reviewCount,
        isVerified: c.isVerified,
        isFeatured: c.isFeatured,
        eventCategoryRelevance: relevanceById.get(c.categoryId) ?? 1,
        conversionRate: convRates.get(c.userId),
        zipCode: c.zipCode,
      }),
    ),
    { eventType: req.eventType, consumerZip: req.zip, limit },
  );

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked: MatchedListing[] = ranking
    .map((r) => {
      const c = byId.get(r.listingId)!;
      return {
        listingId: c.id,
        slug: c.slug,
        name: c.name,
        shortDescription: c.shortDescription,
        city: c.city,
        state: c.state,
        categoryName: c.category.name,
        categorySlug: c.category.slug,
        avgRating: Number(c.avgRating),
        reviewCount: c.reviewCount,
        trustScore: Number(c.trustScore),
        isVerified: c.isVerified,
        isFeatured: c.isFeatured,
        score: r.score,
        scoreBreakdown: r.breakdown,
        strategy: strategy.name,
      };
    });

  await eventBus.publish('matching.completed', {
    requestId: crypto.randomUUID(),
    eventType: req.eventType,
    resultCount: ranked.length,
  });

  return ranked;
}

/**
 * Historical conversion rate = CONVERTED / (CONVERTED + DECLINED + PENDING)
 * over the last 180 days, per business owner. Returns undefined for owners
 * without enough lead history — the strategy will cold-start them to trust.
 */
async function conversionRatesFor(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const cutoff = new Date(Date.now() - 180 * 86400_000);

  const rows = await prisma.consumerLead.groupBy({
    by: ['listingId', 'status'],
    where: {
      listing: { userId: { in: userIds } },
      createdAt: { gte: cutoff },
    },
    _count: { _all: true },
  });

  // Map listingId → userId for reverse aggregation.
  const listings = await prisma.listing.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.listingId))] } },
    select: { id: true, userId: true },
  });
  const ownerByListing = new Map(listings.map((l) => [l.id, l.userId]));

  type Counts = { converted: number; total: number };
  const byOwner = new Map<string, Counts>();
  for (const row of rows) {
    const owner = ownerByListing.get(row.listingId);
    if (!owner) continue;
    const bucket = byOwner.get(owner) ?? { converted: 0, total: 0 };
    bucket.total += row._count._all;
    if (row.status === 'CONVERTED') bucket.converted += row._count._all;
    byOwner.set(owner, bucket);
  }

  const out = new Map<string, number>();
  for (const [owner, { converted, total }] of byOwner) {
    if (total < 5) continue;
    out.set(owner, converted / total);
  }
  return out;
}
