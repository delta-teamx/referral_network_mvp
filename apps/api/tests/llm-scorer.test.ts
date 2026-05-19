import { describe, expect, it } from 'vitest';
import { LlmMatchScoreSchema, isLlmEnabled } from '../src/domains/matching/ai/llm-scorer.service.js';

describe('LLM scorer schema', () => {
  it('accepts a well-formed match score', () => {
    const parsed = LlmMatchScoreSchema.parse({
      score: 82,
      tier: 'level1',
      reason:
        "They run a commercial real-estate firm in Phoenix and you sell title insurance — every closing they touch is a referral to you.",
      signals: {
        industryFit: 9,
        referralPotential: 10,
        geographicFit: 8,
        networkValue: 7,
      },
    });
    expect(parsed.score).toBe(82);
    expect(parsed.tier).toBe('level1');
  });

  it('rejects out-of-range scores', () => {
    expect(() =>
      LlmMatchScoreSchema.parse({
        score: 120,
        tier: 'level1',
        reason: 'A reason that meets the minimum length requirement for the schema.',
        signals: { industryFit: 9, referralPotential: 10, geographicFit: 8, networkValue: 7 },
      }),
    ).toThrow();
  });

  it('rejects unknown tier values', () => {
    expect(() =>
      LlmMatchScoreSchema.parse({
        score: 50,
        tier: 'platinum',
        reason: 'A reason that meets the minimum length requirement for the schema.',
        signals: { industryFit: 5, referralPotential: 5, geographicFit: 5, networkValue: 5 },
      }),
    ).toThrow();
  });

  it('rejects reasons that are too short', () => {
    expect(() =>
      LlmMatchScoreSchema.parse({
        score: 50,
        tier: 'level2',
        reason: 'too short',
        signals: { industryFit: 5, referralPotential: 5, geographicFit: 5, networkValue: 5 },
      }),
    ).toThrow();
  });
});

describe('isLlmEnabled', () => {
  it('returns false when ANTHROPIC_API_KEY is unset', () => {
    expect(isLlmEnabled()).toBe(false);
  });
});
