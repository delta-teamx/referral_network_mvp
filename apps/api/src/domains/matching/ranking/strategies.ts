import type {
  RankedListing,
  RankingCandidate,
  RankingContext,
  RankingStrategy,
} from './RankingStrategy.js';

/**
 * Concrete ranking strategies. Each one is a pure function of the candidates
 * + context, produces a score + per-signal breakdown so the dashboard can
 * render "why this match" explanations.
 *
 * Register them in `registry.ts` and select at runtime via env var or per
 * endpoint. Default used by the connector is `LifeEventMatchStrategy`.
 */

function rankWith(
  candidates: RankingCandidate[],
  context: RankingContext,
  compute: (c: RankingCandidate) => { score: number; breakdown: Record<string, number> },
): RankedListing[] {
  const scored = candidates.map((c) => {
    const { score, breakdown } = compute(c);
    return { listingId: c.listingId, score, breakdown };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, context.limit);
}

/**
 * Trust-weighted: prioritises network credibility over anything else. Use
 * for clients who picked a trust-sensitive category (lawyer, CPA, etc).
 */
export const TrustWeightedStrategy: RankingStrategy = {
  name: 'trust-weighted',
  rank(candidates, context) {
    return rankWith(candidates, context, (c) => {
      const trust = c.trustScore * 3;
      const rating = c.avgRating * 1.5;
      const verified = c.isVerified ? 5 : 0;
      const reviewDepth = Math.min(c.reviewCount, 50) * 0.05;
      return {
        score: trust + rating + verified + reviewDepth,
        breakdown: { trust, rating, verified, reviewDepth },
      };
    });
  },
};

/**
 * Distance-weighted: penalises distance heavily. Use for time-critical
 * services (plumbing emergencies, moving day) where "close" beats "best".
 *
 * Distance comes from `distanceMiles` on the candidate when the search
 * service provides it; otherwise zip-prefix heuristic below.
 */
export const DistanceWeightedStrategy: RankingStrategy = {
  name: 'distance-weighted',
  rank(candidates, context) {
    return rankWith(candidates, context, (c) => {
      const distanceMiles = estimateDistance(context.consumerZip, c.zipCode);
      // Exponential decay: full credit at 0mi, ~halved at 20mi, ~nothing at 60mi.
      const proximity = 20 * Math.exp(-distanceMiles / 25);
      const trust = c.trustScore * 1;
      const rating = c.avgRating * 1;
      const verified = c.isVerified ? 2 : 0;
      return {
        score: proximity + trust + rating + verified,
        breakdown: { proximity, trust, rating, verified, distanceMiles },
      };
    });
  },
};

/**
 * Conversion-weighted: ranks by who ACTUALLY closes leads. Cold-starts to
 * trust for businesses without enough lead history (conversionRate null or
 * based on <5 leads).
 */
export const ConversionWeightedStrategy: RankingStrategy = {
  name: 'conversion-weighted',
  rank(candidates, context) {
    return rankWith(candidates, context, (c) => {
      const hasHistory = typeof c.conversionRate === 'number' && c.reviewCount >= 5;
      const conversion = hasHistory ? (c.conversionRate ?? 0) * 40 : c.trustScore * 2;
      const rating = c.avgRating * 1.5;
      const verified = c.isVerified ? 4 : 0;
      return {
        score: conversion + rating + verified,
        breakdown: {
          conversion,
          rating,
          verified,
          coldStart: hasHistory ? 0 : 1,
        },
      };
    });
  },
};

/**
 * LifeEventMatch: the default for /connect/<event>. Blends all signals with
 * a strong bias toward category-relevance (so a "getting_married" search
 * surfaces wedding planners, not plumbers).
 */
export const LifeEventMatchStrategy: RankingStrategy = {
  name: 'life-event-match',
  rank(candidates, context) {
    return rankWith(candidates, context, (c) => {
      const relevance = (c.eventCategoryRelevance ?? 5) * 3;
      const trust = c.trustScore * 2;
      const rating = c.avgRating * 1.5;
      const verified = c.isVerified ? 5 : 0;
      const featured = c.isFeatured ? 3 : 0;
      const distanceMiles = estimateDistance(context.consumerZip, c.zipCode);
      const proximity = 5 * Math.exp(-distanceMiles / 40);
      return {
        score: relevance + trust + rating + verified + featured + proximity,
        breakdown: {
          relevance,
          trust,
          rating,
          verified,
          featured,
          proximity,
          distanceMiles,
        },
      };
    });
  },
};

/**
 * Zip-prefix proximity heuristic: same-zip = 0 miles, same 3-digit prefix
 * ≈ 15 miles, same state (from zip first digit region) ≈ 80 miles, else 200.
 * Cheap, no geocoding. Replace with PostGIS `<->` distance when we start
 * storing lat/lng on listings (next branch).
 */
export function estimateDistance(a?: string | null, b?: string | null): number {
  if (!a || !b) return 50;
  if (a === b) return 0;
  if (a.slice(0, 3) === b.slice(0, 3)) return 15;
  if (a.slice(0, 1) === b.slice(0, 1)) return 80;
  return 200;
}
