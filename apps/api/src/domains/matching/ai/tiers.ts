import type { MatchResult } from './ai-matching.service.js';

export const TIER_THRESHOLDS = {
  level1: 70,
  level2: 40,
} as const;

export const MAX_RAW_SCORE = 110;

export type MatchTier = 'level1' | 'level2' | 'level3';

export interface TieredMatch extends MatchResult {
  normalizedScore: number;
  tier: MatchTier;
}

export function normalizeScore(rawScore: number): number {
  return Math.max(0, Math.min(100, Math.round((rawScore / MAX_RAW_SCORE) * 100)));
}

export function classifyTier(normalizedScore: number): MatchTier {
  if (normalizedScore >= TIER_THRESHOLDS.level1) return 'level1';
  if (normalizedScore >= TIER_THRESHOLDS.level2) return 'level2';
  return 'level3';
}

export function toTieredMatch(match: MatchResult): TieredMatch {
  const normalizedScore = normalizeScore(match.score);
  return { ...match, normalizedScore, tier: classifyTier(normalizedScore) };
}

export const TIER_LABELS: Record<MatchTier, { title: string; subtitle: string }> = {
  level1: { title: 'High match', subtitle: 'Strong industry and service fit' },
  level2: { title: 'Potential connector', subtitle: 'Valuable network, indirect fit' },
  level3: { title: 'Hidden gem', subtitle: 'Worth a conversation' },
};
