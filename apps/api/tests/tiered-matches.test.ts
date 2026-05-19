import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/domains/matching/ai/ai-matching.service.js', () => ({
  generateMatchesForUser: vi.fn(),
}));

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findMany: vi.fn() },
    introduction: { findMany: vi.fn() },
  },
}));

import { generateTieredMatchesForUser } from '../src/domains/matching/ai/tiered-matches.service.js';
import { generateMatchesForUser } from '../src/domains/matching/ai/ai-matching.service.js';
import { prisma } from '../src/config/prisma.js';

afterEach(() => {
  vi.clearAllMocks();
});

const TARGET_USERS = [
  {
    id: 'u1',
    firstName: 'Alex',
    lastName: 'Iverson',
    avatarUrl: null,
    memberProfile: {
      businessName: 'Iverson Plumbing',
      industry: 'Plumbing',
      headline: null,
      videoUrl: null,
      city: 'Phoenix',
      state: 'AZ',
    },
  },
  {
    id: 'u2',
    firstName: 'Sam',
    lastName: 'Lin',
    avatarUrl: null,
    memberProfile: {
      businessName: 'Lin Realty',
      industry: 'Real Estate',
      headline: null,
      videoUrl: null,
      city: 'Phoenix',
      state: 'AZ',
    },
  },
];

describe('generateTieredMatchesForUser — LLM merge', () => {
  it('marks matches without persisted intros as rules-scored', async () => {
    vi.mocked(generateMatchesForUser).mockResolvedValue([
      { targetUserId: 'u1', score: 90, reason: 'rules reason', factors: { industryAlignment: 25 } },
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue(TARGET_USERS as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([] as never);

    const result = await generateTieredMatchesForUser('viewer');
    const all = [...result.level1, ...result.level2, ...result.level3];
    const u1 = all.find((m) => m.targetUserId === 'u1')!;
    expect(u1.enrichedBy).toBe('rules');
    expect(u1.llmSignals).toBeNull();
    expect(u1.reason).toBe('rules reason');
  });

  it('uses the persisted LLM score and reason when matchFactors.llm is present', async () => {
    vi.mocked(generateMatchesForUser).mockResolvedValue([
      { targetUserId: 'u1', score: 90, reason: 'rules reason', factors: { industryAlignment: 25 } },
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([TARGET_USERS[0]] as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([
      {
        targetId: 'u1',
        matchScore: 47,
        reason: 'They run a plumbing supply house — your kitchen-remodel clients become their counter sales.',
        matchFactors: {
          heuristic: { industryAlignment: 25 },
          llm: {
            industryFit: 8,
            referralPotential: 6,
            geographicFit: 4,
            networkValue: 5,
          },
          tier: 'level2',
        },
      },
    ] as never);

    const result = await generateTieredMatchesForUser('viewer');
    const all = [...result.level1, ...result.level2, ...result.level3];
    const u1 = all.find((m) => m.targetUserId === 'u1')!;
    expect(u1.enrichedBy).toBe('llm');
    expect(u1.normalizedScore).toBe(47);
    expect(u1.reason).toContain('plumbing supply house');
    expect(u1.llmSignals).toEqual({
      industryFit: 8,
      referralPotential: 6,
      geographicFit: 4,
      networkValue: 5,
    });
    expect(u1.tier).toBe('level2');
  });

  it('ignores matchFactors.llm with missing or non-numeric fields', async () => {
    vi.mocked(generateMatchesForUser).mockResolvedValue([
      { targetUserId: 'u1', score: 88, reason: 'rules', factors: {} },
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue([TARGET_USERS[0]] as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([
      {
        targetId: 'u1',
        matchScore: 50,
        reason: null,
        matchFactors: { llm: { industryFit: 'high' } },
      },
    ] as never);

    const result = await generateTieredMatchesForUser('viewer');
    const all = [...result.level1, ...result.level2, ...result.level3];
    const u1 = all.find((m) => m.targetUserId === 'u1')!;
    expect(u1.enrichedBy).toBe('rules');
    expect(u1.llmSignals).toBeNull();
  });

  it('places matches into the tier their normalized score lands in', async () => {
    vi.mocked(generateMatchesForUser).mockResolvedValue([
      { targetUserId: 'u1', score: 50, reason: '', factors: {} },
      { targetUserId: 'u2', score: 30, reason: '', factors: {} },
    ]);
    vi.mocked(prisma.user.findMany).mockResolvedValue(TARGET_USERS as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([
      {
        targetId: 'u1',
        matchScore: 85,
        reason: 'high LLM score',
        matchFactors: {
          llm: { industryFit: 9, referralPotential: 9, geographicFit: 8, networkValue: 8 },
        },
      },
    ] as never);

    const result = await generateTieredMatchesForUser('viewer');
    expect(result.level1.find((m) => m.targetUserId === 'u1')?.normalizedScore).toBe(85);
    expect(result.level3.find((m) => m.targetUserId === 'u2')).toBeTruthy();
  });
});
