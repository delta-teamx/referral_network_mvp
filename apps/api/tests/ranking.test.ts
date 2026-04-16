import { describe, expect, it } from 'vitest';
import type { RankingCandidate } from '../src/domains/matching/ranking/RankingStrategy.js';
import {
  ConversionWeightedStrategy,
  DistanceWeightedStrategy,
  LifeEventMatchStrategy,
  TrustWeightedStrategy,
  estimateDistance,
} from '../src/domains/matching/ranking/strategies.js';

function makeCandidate(over: Partial<RankingCandidate>): RankingCandidate {
  return {
    listingId: 'L',
    score: 0,
    trustScore: 5,
    avgRating: 4,
    reviewCount: 10,
    isVerified: false,
    isFeatured: false,
    ...over,
  };
}

describe('estimateDistance', () => {
  it('returns 0 for identical zips', () => {
    expect(estimateDistance('63108', '63108')).toBe(0);
  });

  it('treats same-prefix as close (~15mi)', () => {
    expect(estimateDistance('63108', '63110')).toBe(15);
  });

  it('treats same state-region zips as medium (~80mi)', () => {
    expect(estimateDistance('63108', '65201')).toBe(80);
  });

  it('treats distant zips as far (~200mi)', () => {
    expect(estimateDistance('63108', '90210')).toBe(200);
  });

  it('defaults to 50mi when either zip is missing', () => {
    expect(estimateDistance(undefined, '63108')).toBe(50);
    expect(estimateDistance(null, null)).toBe(50);
  });
});

describe('TrustWeightedStrategy', () => {
  it('ranks verified + high-trust above unverified low-trust', () => {
    const cs = [
      makeCandidate({ listingId: 'A', trustScore: 9, isVerified: true, avgRating: 4.8 }),
      makeCandidate({ listingId: 'B', trustScore: 4, isVerified: false, avgRating: 4.9 }),
    ];
    const r = TrustWeightedStrategy.rank(cs, { limit: 2 });
    expect(r[0]?.listingId).toBe('A');
    expect(r[0]?.breakdown.verified).toBe(5);
  });

  it('includes review-depth diminishing-return up to 50', () => {
    const r = TrustWeightedStrategy.rank(
      [makeCandidate({ reviewCount: 200 }), makeCandidate({ listingId: 'B', reviewCount: 5 })],
      { limit: 2 },
    );
    // reviewCount is capped at 50 in the formula, so both get ≤ 2.5 from depth
    expect(r[0]?.breakdown.reviewDepth).toBeLessThanOrEqual(2.5);
  });
});

describe('DistanceWeightedStrategy', () => {
  it('ranks closer zips higher when all else is equal', () => {
    const cs = [
      makeCandidate({ listingId: 'FAR', zipCode: '90210' }),
      makeCandidate({ listingId: 'NEAR', zipCode: '63108' }),
    ];
    const r = DistanceWeightedStrategy.rank(cs, { limit: 2, consumerZip: '63108' });
    expect(r[0]?.listingId).toBe('NEAR');
  });
});

describe('ConversionWeightedStrategy', () => {
  it('cold-starts businesses without enough history to trust-based score', () => {
    const cs = [
      makeCandidate({ listingId: 'COLD', trustScore: 9, reviewCount: 2 }), // < 5 reviews
    ];
    const r = ConversionWeightedStrategy.rank(cs, { limit: 1 });
    expect(r[0]?.breakdown.coldStart).toBe(1);
  });

  it('uses real conversionRate for businesses with enough history', () => {
    const cs = [
      makeCandidate({
        listingId: 'HOT',
        reviewCount: 20,
        conversionRate: 0.6,
      }),
    ];
    const r = ConversionWeightedStrategy.rank(cs, { limit: 1 });
    expect(r[0]?.breakdown.coldStart).toBe(0);
    expect(r[0]?.breakdown.conversion).toBeCloseTo(0.6 * 40);
  });
});

describe('LifeEventMatchStrategy', () => {
  it('heavily weights eventCategoryRelevance', () => {
    const cs = [
      makeCandidate({ listingId: 'RELEVANT', eventCategoryRelevance: 10 }),
      makeCandidate({ listingId: 'IRRELEVANT', eventCategoryRelevance: 1 }),
    ];
    const r = LifeEventMatchStrategy.rank(cs, { limit: 2 });
    expect(r[0]?.listingId).toBe('RELEVANT');
    expect(r[0]?.breakdown.relevance).toBeGreaterThan(r[1]?.breakdown.relevance ?? 0);
  });

  it('respects the context.limit', () => {
    const cs = Array.from({ length: 10 }, (_, i) => makeCandidate({ listingId: `L${i}` }));
    const r = LifeEventMatchStrategy.rank(cs, { limit: 3 });
    expect(r).toHaveLength(3);
  });
});
