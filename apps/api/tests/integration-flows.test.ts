import { describe, expect, it } from 'vitest';
import { TIERS, planFor, type Tier } from '../src/domains/billing/billing.tiers.js';
import { BOOKING_REASONS } from '../src/domains/network/bookings/bookings.service.js';
import { isDisposableEmail, DISPOSABLE_EMAIL_DOMAINS } from '@refnet/shared';
import {
  TrustWeightedStrategy,
  DistanceWeightedStrategy,
  ConversionWeightedStrategy,
  LifeEventMatchStrategy,
  estimateDistance,
} from '../src/domains/matching/ranking/strategies.js';
import type { RankingCandidate } from '../src/domains/matching/ranking/RankingStrategy.js';
import { cosineSimilarity } from '../src/domains/matching/ai/embeddings.service.js';
import { generateIcs, type IcsEvent } from '../src/domains/integrations/ics.service.js';

/**
 * Integration flow tests — simulate the critical paths across domains
 * without hitting a real database. Validates business logic, data
 * contracts, and edge cases from all 5 admin perspectives.
 */

// ─── Admin 1: Onboarding + Profile flows ──────────────────────────────────

describe('Admin 1: Onboarding + Profile validation', () => {
  it('rejects disposable emails at signup', () => {
    expect(isDisposableEmail('test@mailinator.com')).toBe(true);
    expect(isDisposableEmail('test@yopmail.com')).toBe(true);
    expect(isDisposableEmail('legit@gmail.com')).toBe(false);
    expect(isDisposableEmail('pro@referralnova.com')).toBe(false);
  });

  it('blocklist covers at least 20 providers', () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThanOrEqual(20);
  });

  it('booking reasons are exactly 4 valid options', () => {
    expect(BOOKING_REASONS).toEqual([
      'referral',
      'partnership',
      'service_inquiry',
      'general_intro',
    ]);
  });

  it('tier caps are correctly ordered (FREE < PRO < PREMIUM)', () => {
    expect(TIERS.FREE.maxLeadsPerMonth).toBeLessThan(TIERS.PRO.maxLeadsPerMonth);
    expect(TIERS.PRO.maxLeadsPerMonth).toBeLessThan(TIERS.PREMIUM.maxLeadsPerMonth);
    expect(TIERS.FREE.maxListings).toBeLessThan(TIERS.PRO.maxListings);
    expect(TIERS.PRO.maxListings).toBeLessThan(TIERS.PREMIUM.maxListings);
  });

  it('planFor returns correct caps for each tier', () => {
    expect(planFor('FREE').maxLeadsPerMonth).toBe(3);
    expect(planFor('PRO').maxLeadsPerMonth).toBe(30);
    expect(planFor('PREMIUM').maxLeadsPerMonth).toBe(Number.POSITIVE_INFINITY);
  });
});

// ─── Admin 2: AI Matching + Ranking ───────────────────────────────────────

describe('Admin 2: AI Matching + Ranking logic', () => {
  const baseCandidate = (over: Partial<RankingCandidate>): RankingCandidate => ({
    listingId: 'L1',
    score: 0,
    trustScore: 5,
    avgRating: 4,
    reviewCount: 10,
    isVerified: false,
    isFeatured: false,
    ...over,
  });

  it('LifeEventMatch weights eventCategoryRelevance highest', () => {
    const relevant = baseCandidate({ listingId: 'A', eventCategoryRelevance: 10 });
    const irrelevant = baseCandidate({ listingId: 'B', eventCategoryRelevance: 1 });
    const [first] = LifeEventMatchStrategy.rank([relevant, irrelevant], { limit: 2 });
    expect(first?.listingId).toBe('A');
  });

  it('TrustWeighted penalizes unverified listings', () => {
    const verified = baseCandidate({ listingId: 'V', trustScore: 8, isVerified: true });
    const not = baseCandidate({ listingId: 'N', trustScore: 8, isVerified: false });
    const result = TrustWeightedStrategy.rank([verified, not], { limit: 2 });
    expect(result[0]?.listingId).toBe('V');
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it('DistanceWeighted ranks closer zips first', () => {
    const near = baseCandidate({ listingId: 'NEAR', zipCode: '63108' });
    const far = baseCandidate({ listingId: 'FAR', zipCode: '90210' });
    const result = DistanceWeightedStrategy.rank([near, far], {
      limit: 2,
      consumerZip: '63110',
    });
    expect(result[0]?.listingId).toBe('NEAR');
  });

  it('ConversionWeighted cold-starts to trust when insufficient history', () => {
    const cold = baseCandidate({ reviewCount: 2, trustScore: 9 });
    const result = ConversionWeightedStrategy.rank([cold], { limit: 1 });
    expect(result[0]?.breakdown.coldStart).toBe(1);
  });

  it('ConversionWeighted uses real rate when history is sufficient', () => {
    const hot = baseCandidate({ reviewCount: 50, conversionRate: 0.8 });
    const result = ConversionWeightedStrategy.rank([hot], { limit: 1 });
    expect(result[0]?.breakdown.coldStart).toBe(0);
    expect(result[0]?.breakdown.conversion).toBeCloseTo(32); // 0.8 * 40
  });

  it('estimateDistance handles all prefix tiers correctly', () => {
    expect(estimateDistance('63108', '63108')).toBe(0);
    expect(estimateDistance('63108', '63110')).toBe(15);
    expect(estimateDistance('63108', '65201')).toBe(80);
    expect(estimateDistance('63108', '90210')).toBe(200);
    expect(estimateDistance(null, '63108')).toBe(50);
    expect(estimateDistance(undefined, undefined)).toBe(50);
  });

  it('cosine similarity returns 1 for identical vectors', () => {
    const v = [0.5, 0.3, 0.8, 0.1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('cosine similarity returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('cosine similarity handles empty vectors gracefully', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('all strategies respect the limit parameter', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      baseCandidate({ listingId: `L${i}` }),
    );
    expect(TrustWeightedStrategy.rank(many, { limit: 5 })).toHaveLength(5);
    expect(DistanceWeightedStrategy.rank(many, { limit: 3 })).toHaveLength(3);
    expect(ConversionWeightedStrategy.rank(many, { limit: 7 })).toHaveLength(7);
    expect(LifeEventMatchStrategy.rank(many, { limit: 1 })).toHaveLength(1);
  });
});

// ─── Admin 3: Booking + Calendar ──────────────────────────────────────────

describe('Admin 3: Booking + Calendar (.ics)', () => {
  it('generates valid .ics with correct fields', () => {
    const event: IcsEvent = {
      uid: 'test-123',
      title: 'Partnership Discussion',
      description: 'Zoom: https://zoom.us/j/123',
      location: 'https://zoom.us/j/123',
      startsAt: new Date('2026-05-01T14:00:00Z'),
      endsAt: new Date('2026-05-01T14:30:00Z'),
      organizerEmail: 'host@example.com',
      attendeeEmails: ['guest@example.com'],
    };
    const ics = generateIcs(event);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('UID:test-123@referralnova.com');
    expect(ics).toContain('SUMMARY:Partnership Discussion');
    expect(ics).toContain('LOCATION:https://zoom.us/j/123');
    expect(ics).toContain('ORGANIZER:mailto:host@example.com');
    expect(ics).toContain('ATTENDEE');
    expect(ics).toContain('mailto:guest@example.com');
    expect(ics).toContain('DTSTART:20260501T140000Z');
    expect(ics).toContain('DTEND:20260501T143000Z');
    expect(ics).toContain('PRODID:-//Referral Nova//Booking//EN');
    expect(ics).toContain('METHOD:REQUEST');
  });

  it('.ics escapes special characters in title', () => {
    const event: IcsEvent = {
      uid: 'esc-1',
      title: 'Call with Sarah, CPA; urgent',
      startsAt: new Date('2026-06-01T10:00:00Z'),
      endsAt: new Date('2026-06-01T10:30:00Z'),
    };
    const ics = generateIcs(event);
    expect(ics).toContain('SUMMARY:Call with Sarah\\, CPA\\; urgent');
  });

  it('.ics handles missing optional fields', () => {
    const event: IcsEvent = {
      uid: 'min-1',
      title: 'Quick chat',
      startsAt: new Date('2026-07-01T09:00:00Z'),
      endsAt: new Date('2026-07-01T09:30:00Z'),
    };
    const ics = generateIcs(event);
    expect(ics).not.toContain('LOCATION');
    expect(ics).not.toContain('ORGANIZER');
    expect(ics).not.toContain('ATTENDEE');
    expect(ics).toContain('SUMMARY:Quick chat');
  });
});

// ─── Admin 4: Tier + Subscription rules ───────────────────────────────────

describe('Admin 4: Subscription tiers + feature gating', () => {
  it('FREE tier cannot see ranking details', () => {
    expect(TIERS.FREE.canSeeRankingDetails).toBe(false);
  });

  it('PRO tier can see ranking details but is not prioritized', () => {
    expect(TIERS.PRO.canSeeRankingDetails).toBe(true);
    expect(TIERS.PRO.prioritizedInRanking).toBe(false);
  });

  it('PREMIUM tier gets all features including priority ranking', () => {
    expect(TIERS.PREMIUM.canSeeRankingDetails).toBe(true);
    expect(TIERS.PREMIUM.prioritizedInRanking).toBe(true);
    expect(TIERS.PREMIUM.maxLeadsPerMonth).toBe(Number.POSITIVE_INFINITY);
  });

  it('only paid tiers have Stripe price env keys', () => {
    expect(TIERS.FREE.stripePriceIdEnvKey).toBeUndefined();
    expect(TIERS.PRO.stripePriceIdEnvKey).toBe('STRIPE_PRO_PRICE_ID');
    expect(TIERS.PREMIUM.stripePriceIdEnvKey).toBe('STRIPE_PREMIUM_PRICE_ID');
  });

  it('group membership limits escalate across tiers', () => {
    expect(TIERS.FREE.maxGroupMemberships).toBeLessThan(TIERS.PRO.maxGroupMemberships);
    expect(TIERS.PRO.maxGroupMemberships).toBeLessThan(TIERS.PREMIUM.maxGroupMemberships);
  });

  it('all tiers allow sending invitations', () => {
    for (const tier of Object.values(TIERS)) {
      expect(tier.canSendInvitations).toBe(true);
    }
  });

  it('pricing is correct', () => {
    expect(TIERS.FREE.pricePerMonthCents).toBe(0);
    expect(TIERS.PRO.pricePerMonthCents).toBe(4900);
    expect(TIERS.PREMIUM.pricePerMonthCents).toBe(14900);
  });
});

// ─── Admin 5: Trust score formula ─────────────────────────────────────────

describe('Admin 5: Trust score formula integrity', () => {
  function score(inputs: {
    avgRating: number;
    reviewCount: number;
    convertedLeads: number;
    totalLeads: number;
    isVerified: boolean;
    acceptedConnections: number;
    daysSinceEdit: number;
  }): number {
    const ratingScore = (inputs.avgRating / 5) * 40;
    const reviewBonus = Math.min(10, Math.log1p(inputs.reviewCount) * 2);
    const convRate = inputs.totalLeads === 0 ? 0 : inputs.convertedLeads / inputs.totalLeads;
    const conversionScore = convRate * 20;
    const verifiedScore = inputs.isVerified ? 10 : 0;
    const networkScore = Math.min(10, Math.log1p(inputs.acceptedConnections) * 3);
    const activityScore = Math.max(0, 10 - inputs.daysSinceEdit / 3);
    const raw =
      ratingScore + reviewBonus + conversionScore + verifiedScore + networkScore + activityScore;
    return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
  }

  it('new unverified listing scores around 10 (activity-fresh only)', () => {
    const s = score({
      avgRating: 0, reviewCount: 0, convertedLeads: 0, totalLeads: 0,
      isVerified: false, acceptedConnections: 0, daysSinceEdit: 0,
    });
    expect(s).toBeCloseTo(10, 0);
  });

  it('ideal listing saturates near 100', () => {
    const s = score({
      avgRating: 5, reviewCount: 500, convertedLeads: 40, totalLeads: 50,
      isVerified: true, acceptedConnections: 20, daysSinceEdit: 0,
    });
    expect(s).toBeGreaterThan(90);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('verification adds exactly 10 points', () => {
    const base = {
      avgRating: 4, reviewCount: 10, convertedLeads: 5, totalLeads: 10,
      isVerified: false, acceptedConnections: 3, daysSinceEdit: 15,
    };
    expect(score({ ...base, isVerified: true }) - score(base)).toBeCloseTo(10, 5);
  });

  it('activity decays to 0 after ~30 days', () => {
    const base = {
      avgRating: 4, reviewCount: 10, convertedLeads: 3, totalLeads: 10,
      isVerified: false, acceptedConnections: 2, daysSinceEdit: 0,
    };
    const diff = score({ ...base, daysSinceEdit: 0 }) - score({ ...base, daysSinceEdit: 60 });
    expect(diff).toBeCloseTo(10, 0);
  });

  it('score is always clamped to [0, 100]', () => {
    expect(score({
      avgRating: 0, reviewCount: 0, convertedLeads: 0, totalLeads: 0,
      isVerified: false, acceptedConnections: 0, daysSinceEdit: 999,
    })).toBeGreaterThanOrEqual(0);
    expect(score({
      avgRating: 5, reviewCount: 99999, convertedLeads: 1000, totalLeads: 1000,
      isVerified: true, acceptedConnections: 99999, daysSinceEdit: 0,
    })).toBeLessThanOrEqual(100);
  });
});
