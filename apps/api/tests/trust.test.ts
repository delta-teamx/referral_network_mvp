import { describe, expect, it } from 'vitest';

/**
 * Trust-score formula unit test — exercises the pure scoring math without
 * touching the DB. The actual recompute function queries Prisma; this
 * mirror-of-the-formula lets us assert ranges and weights cheaply.
 */

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
  const raw = ratingScore + reviewBonus + conversionScore + verifiedScore + networkScore + activityScore;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

describe('trust-score formula', () => {
  it('brand-new unverified listing starts low', () => {
    const s = score({
      avgRating: 0,
      reviewCount: 0,
      convertedLeads: 0,
      totalLeads: 0,
      isVerified: false,
      acceptedConnections: 0,
      daysSinceEdit: 0,
    });
    // Just the 10-point activity-fresh bonus.
    expect(s).toBeCloseTo(10, 0);
  });

  it('ideal listing saturates near 100', () => {
    const s = score({
      avgRating: 5,
      reviewCount: 500,
      convertedLeads: 40,
      totalLeads: 50,
      isVerified: true,
      acceptedConnections: 20,
      daysSinceEdit: 0,
    });
    expect(s).toBeGreaterThan(90);
  });

  it('verification adds exactly 10 points', () => {
    const base = {
      avgRating: 4,
      reviewCount: 10,
      convertedLeads: 5,
      totalLeads: 10,
      isVerified: false,
      acceptedConnections: 3,
      daysSinceEdit: 15,
    } as const;
    const a = score(base);
    const b = score({ ...base, isVerified: true });
    expect(b - a).toBeCloseTo(10, 5);
  });

  it('activity decay drops to 0 after 30 days', () => {
    const base = {
      avgRating: 4,
      reviewCount: 10,
      convertedLeads: 3,
      totalLeads: 10,
      isVerified: false,
      acceptedConnections: 2,
    };
    const fresh = score({ ...base, daysSinceEdit: 0 });
    const stale = score({ ...base, daysSinceEdit: 60 });
    expect(fresh - stale).toBeCloseTo(10, 5);
  });

  it('score is clamped into [0, 100]', () => {
    const lo = score({
      avgRating: 0,
      reviewCount: 0,
      convertedLeads: 0,
      totalLeads: 0,
      isVerified: false,
      acceptedConnections: 0,
      daysSinceEdit: 365,
    });
    const hi = score({
      avgRating: 5,
      reviewCount: 99999,
      convertedLeads: 1000,
      totalLeads: 1000,
      isVerified: true,
      acceptedConnections: 99999,
      daysSinceEdit: 0,
    });
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(100);
  });
});
