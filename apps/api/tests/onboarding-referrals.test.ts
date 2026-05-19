import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    introduction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: { findMany: vi.fn() },
  },
}));

vi.mock('../src/domains/matching/ai/ai-matching.service.js', () => ({
  generateMatchesForUser: vi.fn(),
}));

import {
  ONBOARDING_TARGET_PER_MONTH,
  assignOnboardingReferrals,
  onboardingMonthFor,
} from '../src/domains/matching/ai/onboarding-referrals.service.js';
import { prisma } from '../src/config/prisma.js';
import { generateMatchesForUser } from '../src/domains/matching/ai/ai-matching.service.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('assignOnboardingReferrals', () => {
  it('assigns the per-month target when no prior intros exist', async () => {
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([] as never);
    vi.mocked(generateMatchesForUser).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        targetUserId: `t${i}`,
        score: 80 - i,
        reason: `reason ${i}`,
        factors: {},
      })),
    );
    vi.mocked(prisma.introduction.create).mockResolvedValue({ id: 'intro' } as never);

    const result = await assignOnboardingReferrals('u1', { month: 1 });

    expect(result.assigned).toBe(ONBOARDING_TARGET_PER_MONTH);
    expect(result.totalActiveForMonth).toBe(ONBOARDING_TARGET_PER_MONTH);
    expect(prisma.introduction.create).toHaveBeenCalledTimes(ONBOARDING_TARGET_PER_MONTH);
  });

  it('tops up to the target without re-assigning existing month-1 introductions', async () => {
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([
      ...Array.from({ length: 4 }, (_, i) => ({
        targetId: `existing${i}`,
        status: 'suggested',
        matchFactors: { onboarding: { month: 1, batch: 'auto' } },
      })),
    ] as never);
    vi.mocked(generateMatchesForUser).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        targetUserId: `t${i}`,
        score: 80 - i,
        reason: '',
        factors: {},
      })),
    );
    vi.mocked(prisma.introduction.create).mockResolvedValue({ id: 'x' } as never);

    const result = await assignOnboardingReferrals('u1', { month: 1 });

    expect(result.assigned).toBe(6);
    expect(result.totalActiveForMonth).toBe(10);
  });

  it('skips candidates already targeted by any active introduction', async () => {
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([
      { targetId: 't0', status: 'accepted', matchFactors: null },
      { targetId: 't1', status: 'requested', matchFactors: null },
    ] as never);
    vi.mocked(generateMatchesForUser).mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        targetUserId: `t${i}`,
        score: 80 - i,
        reason: '',
        factors: {},
      })),
    );
    vi.mocked(prisma.introduction.create).mockResolvedValue({ id: 'x' } as never);

    const result = await assignOnboardingReferrals('u2', { month: 2 });

    expect(result.assigned).toBe(10);
    const createdTargetIds = vi
      .mocked(prisma.introduction.create)
      .mock.calls.map(([arg]) => (arg as { data: { targetId: string } }).data.targetId);
    expect(createdTargetIds).not.toContain('t0');
    expect(createdTargetIds).not.toContain('t1');
  });

  it('returns 0 assigned when the member already has the target count for the month', async () => {
    vi.mocked(prisma.introduction.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        targetId: `existing${i}`,
        status: 'suggested',
        matchFactors: { onboarding: { month: 3, batch: 'auto' } },
      })) as never,
    );

    const result = await assignOnboardingReferrals('u1', { month: 3 });

    expect(result.assigned).toBe(0);
    expect(result.totalActiveForMonth).toBe(10);
    expect(prisma.introduction.create).not.toHaveBeenCalled();
  });

  it('rejects invalid month values', async () => {
    await expect(assignOnboardingReferrals('u1', { month: 0 })).rejects.toThrow();
    await expect(assignOnboardingReferrals('u1', { month: 4 })).rejects.toThrow();
  });
});

describe('onboardingMonthFor', () => {
  it('returns the calendar-month index for the first 3 months after signup', () => {
    const signup = new Date('2026-01-15T00:00:00Z');
    expect(onboardingMonthFor(signup, new Date('2026-01-20T00:00:00Z'))).toBe(1);
    expect(onboardingMonthFor(signup, new Date('2026-02-05T00:00:00Z'))).toBe(2);
    expect(onboardingMonthFor(signup, new Date('2026-03-10T00:00:00Z'))).toBe(3);
  });

  it('returns null after the 3-month window', () => {
    const signup = new Date('2026-01-15T00:00:00Z');
    expect(onboardingMonthFor(signup, new Date('2026-04-01T00:00:00Z'))).toBeNull();
    expect(onboardingMonthFor(signup, new Date('2027-01-01T00:00:00Z'))).toBeNull();
  });
});
