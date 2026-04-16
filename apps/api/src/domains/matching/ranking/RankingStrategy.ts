import type { SearchHit } from '../../search/SearchService.js';

/**
 * Candidate listing considered for ranking, enriched with the signals
 * a `RankingStrategy` might care about. The concrete strategy decides
 * which signals actually contribute to the final score.
 */
export interface RankingCandidate extends SearchHit {
  /** Normalised 0–10 trust score (see Branch 3 trust-score job). */
  trustScore: number;
  /** 0–5 average rating. */
  avgRating: number;
  /** Lifetime review count; a weak recency/credibility signal. */
  reviewCount: number;
  /** Has the owner verified the listing? */
  isVerified: boolean;
  /** Is the listing a paid feature slot? (Subscription tier decides.) */
  isFeatured: boolean;
  /** Event-type ↔ category relevance (1 = weak fit, 10 = strong fit). */
  eventCategoryRelevance?: number;
  /** Historical conversion rate on matched leads (0–1), null if sparse. */
  conversionRate?: number;
  /** 5-digit US ZIP; used for zip-prefix proximity until PostGIS lands. */
  zipCode?: string;
}

export interface RankingContext {
  /** Life event driving this match, if applicable. */
  eventType?: string;
  /** Consumer's zip for tie-breaking. */
  consumerZip?: string;
  /** Cap on results returned after re-ranking. */
  limit: number;
}

export interface RankedListing {
  listingId: string;
  /** Final score used for sorting. Higher is better. */
  score: number;
  /**
   * Per-signal breakdown — useful for debugging, A/B tests, and
   * explaining results back to business owners in the dashboard.
   */
  breakdown: Record<string, number>;
}

/**
 * Strategy pattern — swap the implementation per call site without
 * every caller learning a new API.
 *
 * Planned Branch 5 strategies:
 *   - `TrustWeightedStrategy`:     trust × 3 + rating × 1.5 + verified bonus
 *   - `DistanceWeightedStrategy`:  penalise distance heavily (emergency jobs)
 *   - `ConversionWeightedStrategy`: weight conversionRate, cold-start to trust
 *   - `LifeEventMatchStrategy`:    combines all of the above per the spec
 */
export interface RankingStrategy {
  readonly name: string;

  rank(candidates: RankingCandidate[], context: RankingContext): RankedListing[];
}
