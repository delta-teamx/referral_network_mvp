import { describe, expect, it } from 'vitest';
import { TIERS, planFor } from '../src/domains/billing/billing.tiers.js';

describe('Subscription tiers', () => {
  it('FREE has a 3-lead/month cap', () => {
    expect(TIERS.FREE.maxLeadsPerMonth).toBe(3);
  });

  it('PRO is $49/mo and gets 30 leads', () => {
    const pro = planFor('PRO');
    expect(pro.pricePerMonthCents).toBe(4900);
    expect(pro.maxLeadsPerMonth).toBe(30);
    expect(pro.canSeeRankingDetails).toBe(true);
  });

  it('PREMIUM is $149/mo and has unlimited leads', () => {
    const prem = planFor('PREMIUM');
    expect(prem.pricePerMonthCents).toBe(14900);
    expect(prem.maxLeadsPerMonth).toBe(Number.POSITIVE_INFINITY);
    expect(prem.prioritizedInRanking).toBe(true);
  });

  it('only paid tiers are mapped to a Stripe price env key', () => {
    expect(TIERS.FREE.stripePriceIdEnvKey).toBeUndefined();
    expect(TIERS.PRO.stripePriceIdEnvKey).toBe('STRIPE_PRO_PRICE_ID');
    expect(TIERS.PREMIUM.stripePriceIdEnvKey).toBe('STRIPE_PREMIUM_PRICE_ID');
  });

  it('feature flags escalate correctly across tiers', () => {
    expect(TIERS.FREE.canSeeRankingDetails).toBe(false);
    expect(TIERS.PRO.canSeeRankingDetails).toBe(true);
    expect(TIERS.PREMIUM.canSeeRankingDetails).toBe(true);

    expect(TIERS.FREE.prioritizedInRanking).toBe(false);
    expect(TIERS.PRO.prioritizedInRanking).toBe(false);
    expect(TIERS.PREMIUM.prioritizedInRanking).toBe(true);
  });
});
