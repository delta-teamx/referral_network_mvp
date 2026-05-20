import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/domains/matching/ai/ai-matching.service.js', () => ({
  refreshSuggestionsForUser: vi.fn(async () => 1),
}));

vi.mock('../src/domains/matching/ai/llm-refinement.service.js', () => ({
  refineSuggestionsForUser: vi.fn(async () => ({ refined: 3, skipped: 0, failed: 0 })),
}));

vi.mock('../src/domains/matching/ai/llm-scorer.service.js', () => ({
  isLlmEnabled: vi.fn(() => false),
}));

vi.mock('../src/domains/matching/ai/onboarding-referrals.service.js', () => ({
  topUpOnboardingReferralsForAllMembers: vi.fn(async () => ({ membersTouched: 0, assigned: 0 })),
}));

vi.mock('../src/domains/matching/ai/referral-digest.service.js', () => ({
  sendWeeklyReferralDigestForAllMembers: vi.fn(async () => ({
    membersConsidered: 0,
    emailsSent: 0,
    skippedEmpty: 0,
    errors: 0,
  })),
}));

vi.mock('../src/domains/matching/ai/ai-learning.service.js', () => ({
  retrainFromOutcomes: vi.fn(async () => ({
    introsProcessed: 0,
    newWeights: {
      industryAlignment: 1,
      reverseAlignment: 1,
      referralToMe: 1,
      referralFromMe: 1,
      keywordOverlap: 1,
      location: 1,
    },
  })),
}));

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    memberProfile: {
      findMany: vi.fn(async () => [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]),
    },
  },
}));

import { runDailyMatchesRefresh } from '../src/domains/matching/ai/matches.scheduler.js';
import { refreshSuggestionsForUser } from '../src/domains/matching/ai/ai-matching.service.js';
import { refineSuggestionsForUser } from '../src/domains/matching/ai/llm-refinement.service.js';
import { isLlmEnabled } from '../src/domains/matching/ai/llm-scorer.service.js';
import { sendWeeklyReferralDigestForAllMembers } from '../src/domains/matching/ai/referral-digest.service.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('runDailyMatchesRefresh', () => {
  it('refreshes every active member when LLM is disabled', async () => {
    const stats = await runDailyMatchesRefresh();
    expect(stats.usersScanned).toBe(3);
    expect(stats.rulesRefreshed).toBe(3);
    expect(stats.llmRefined).toBe(0);
    expect(stats.errors).toBe(0);
    expect(refreshSuggestionsForUser).toHaveBeenCalledTimes(3);
    expect(refineSuggestionsForUser).not.toHaveBeenCalled();
  });

  it('runs LLM refinement when enabled', async () => {
    vi.mocked(isLlmEnabled).mockReturnValueOnce(true);
    const stats = await runDailyMatchesRefresh({ perUserDelayMs: 0 });
    expect(stats.llmRefined).toBe(9);
    expect(refineSuggestionsForUser).toHaveBeenCalledTimes(3);
  });

  it('counts per-user failures without stopping the run', async () => {
    vi.mocked(refreshSuggestionsForUser)
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(1);
    const stats = await runDailyMatchesRefresh();
    expect(stats.rulesRefreshed).toBe(2);
    expect(stats.errors).toBe(1);
  });

  it('skips the weekly digest on non-Monday runs', async () => {
    // Tuesday 2026-05-19
    await runDailyMatchesRefresh({ now: new Date('2026-05-19T09:00:00Z'), perUserDelayMs: 0 });
    expect(sendWeeklyReferralDigestForAllMembers).not.toHaveBeenCalled();
  });

  it('fires the weekly digest on Monday runs', async () => {
    // Monday 2026-05-18
    const stats = await runDailyMatchesRefresh({
      now: new Date('2026-05-18T09:00:00Z'),
      perUserDelayMs: 0,
    });
    expect(sendWeeklyReferralDigestForAllMembers).toHaveBeenCalledTimes(1);
    expect(stats.digestsSent).toBe(0); // mocked to return emailsSent:0
  });
});
