import { prisma } from '../../../config/prisma.js';

/**
 * AI learning loop — adjusts matching weights based on actual outcomes.
 *
 * The core idea: when an Introduction leads to "deal_closed", every matching
 * factor that contributed positively to that match should get boosted. When
 * it results in "no_fit", the same factors should be dampened.
 *
 * V1 implementation: simple global weight multipliers stored in a
 * `MatchingWeights` config row. The scheduler calls
 * `retrainFromOutcomes()` nightly, which scans completed intros from the
 * last 30 days and adjusts weights via exponential moving average.
 *
 * V2 (future): per-user preference vectors, OpenAI fine-tuning on
 * successful matches, reinforcement learning on intro acceptance rates.
 */

export interface WeightConfig {
  industryAlignment: number;
  reverseAlignment: number;
  referralToMe: number;
  referralFromMe: number;
  keywordOverlap: number;
  location: number;
}

const DEFAULT_WEIGHTS: WeightConfig = {
  industryAlignment: 1.0,
  reverseAlignment: 1.0,
  referralToMe: 1.0,
  referralFromMe: 1.0,
  keywordOverlap: 1.0,
  location: 1.0,
};

const LEARNING_RATE = 0.1;
const POSITIVE_OUTCOMES = new Set(['met', 'referred', 'deal_closed']);
const NEGATIVE_OUTCOMES = new Set(['no_fit']);

/**
 * Read current global weights. Falls back to defaults if no row exists.
 */
export async function getWeights(): Promise<WeightConfig> {
  const row = await prisma.domainEvent.findFirst({
    where: { type: 'ai.weights_updated' },
    orderBy: { publishedAt: 'desc' },
    select: { payload: true },
  });
  if (!row || !row.payload) return { ...DEFAULT_WEIGHTS };
  const p = row.payload as Record<string, unknown>;
  return {
    industryAlignment: Number(p.industryAlignment ?? DEFAULT_WEIGHTS.industryAlignment),
    reverseAlignment: Number(p.reverseAlignment ?? DEFAULT_WEIGHTS.reverseAlignment),
    referralToMe: Number(p.referralToMe ?? DEFAULT_WEIGHTS.referralToMe),
    referralFromMe: Number(p.referralFromMe ?? DEFAULT_WEIGHTS.referralFromMe),
    keywordOverlap: Number(p.keywordOverlap ?? DEFAULT_WEIGHTS.keywordOverlap),
    location: Number(p.location ?? DEFAULT_WEIGHTS.location),
  };
}

/**
 * Retrain from the last 30 days of completed introductions.
 *
 * For each completed intro:
 *   - Look at matchFactors (stored as JSON when the intro was created)
 *   - If outcome is positive → nudge weights toward factors that scored high
 *   - If outcome is negative → nudge weights away from those factors
 *
 * The adjustment is an exponential moving average so recent outcomes have
 * more influence than old ones, but the system doesn't swing wildly.
 */
export async function retrainFromOutcomes(): Promise<{
  introsProcessed: number;
  newWeights: WeightConfig;
}> {
  const since = new Date(Date.now() - 30 * 86400_000);

  const intros = await prisma.introduction.findMany({
    where: {
      status: 'completed',
      completedAt: { gte: since },
      outcome: { not: null },
    },
    select: { matchFactors: true, outcome: true, matchScore: true },
  });

  if (intros.length === 0) {
    return { introsProcessed: 0, newWeights: await getWeights() };
  }

  const weights = await getWeights();
  const factorKeys = Object.keys(DEFAULT_WEIGHTS) as (keyof WeightConfig)[];

  for (const intro of intros) {
    const factors = (intro.matchFactors ?? {}) as Record<string, number>;
    const isPositive = POSITIVE_OUTCOMES.has(intro.outcome ?? '');
    const isNegative = NEGATIVE_OUTCOMES.has(intro.outcome ?? '');
    if (!isPositive && !isNegative) continue;

    const direction = isPositive ? 1 : -1;

    for (const key of factorKeys) {
      const factorValue = factors[key] ?? 0;
      if (factorValue === 0) continue;
      // Nudge the weight: positive outcomes boost, negative dampen
      const adjustment = direction * LEARNING_RATE * (factorValue > 0 ? 1 : 0);
      weights[key] = Math.max(0.1, Math.min(5.0, weights[key] + adjustment));
    }
  }

  // Persist as a DomainEvent (append-only log of weight evolution)
  await prisma.domainEvent.create({
    data: {
      type: 'ai.weights_updated',
      aggregateId: 'global',
      payload: weights as unknown as object,
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `[ai-learning] retrained from ${intros.length} intros. New weights:`,
    JSON.stringify(weights),
  );

  return { introsProcessed: intros.length, newWeights: weights };
}

/**
 * Platform-level analytics on the AI matching quality.
 */
export async function getMatchingStats() {
  const [total, accepted, declined, completed, dealsClosed] = await Promise.all([
    prisma.introduction.count(),
    prisma.introduction.count({ where: { status: 'accepted' } }),
    prisma.introduction.count({ where: { status: 'declined' } }),
    prisma.introduction.count({ where: { status: 'completed' } }),
    prisma.introduction.count({ where: { outcome: 'deal_closed' } }),
  ]);

  const totalDealValue = await prisma.introduction.aggregate({
    where: { outcome: 'deal_closed' },
    _sum: { dealValue: true },
  });

  return {
    totalIntros: total,
    accepted,
    declined,
    completed,
    dealsClosed,
    totalDealValue: Number(totalDealValue._sum.dealValue ?? 0),
    acceptRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
    conversionRate: accepted > 0 ? Math.round((dealsClosed / accepted) * 100) : 0,
  };
}
