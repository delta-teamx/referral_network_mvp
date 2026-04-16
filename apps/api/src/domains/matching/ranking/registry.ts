import type { RankingStrategy } from './RankingStrategy.js';
import {
  ConversionWeightedStrategy,
  DistanceWeightedStrategy,
  LifeEventMatchStrategy,
  TrustWeightedStrategy,
} from './strategies.js';

/**
 * Runtime registry of ranking strategies. `strategyByName` is used by the
 * connector to pick a strategy via env var `RANKING_STRATEGY` or per-request
 * override header. Default is LifeEventMatch.
 */

export const STRATEGIES: Record<string, RankingStrategy> = {
  [LifeEventMatchStrategy.name]: LifeEventMatchStrategy,
  [TrustWeightedStrategy.name]: TrustWeightedStrategy,
  [DistanceWeightedStrategy.name]: DistanceWeightedStrategy,
  [ConversionWeightedStrategy.name]: ConversionWeightedStrategy,
};

export const DEFAULT_STRATEGY_NAME = LifeEventMatchStrategy.name;

export function strategyByName(name?: string | null): RankingStrategy {
  if (!name) return STRATEGIES[DEFAULT_STRATEGY_NAME]!;
  return STRATEGIES[name] ?? STRATEGIES[DEFAULT_STRATEGY_NAME]!;
}
