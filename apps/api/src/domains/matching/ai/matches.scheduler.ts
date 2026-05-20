import { prisma } from '../../../config/prisma.js';
import { refreshSuggestionsForUser } from './ai-matching.service.js';
import { refineSuggestionsForUser } from './llm-refinement.service.js';
import { isLlmEnabled } from './llm-scorer.service.js';
import { topUpOnboardingReferralsForAllMembers } from './onboarding-referrals.service.js';
import { sendWeeklyReferralDigestForAllMembers } from './referral-digest.service.js';
import { retrainFromOutcomes } from './ai-learning.service.js';

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastRunUtcDate: string | null = null;

/**
 * Daily matches scheduler. Wakes hourly; at MATCH_REFRESH_HOUR_UTC (8 UTC =
 * 3 AM EST) it walks active members, regenerates rules-based suggestions, and
 * — when ANTHROPIC_API_KEY is configured — refines the top suggestions per
 * user with Claude.
 *
 * Bounded by REFINE_USER_CAP_PER_RUN to keep nightly LLM spend predictable
 * while we tune. Users are picked by least-recently-active so everyone
 * eventually cycles through. Per-user errors are caught so one bad profile
 * does not stop the run.
 *
 * In production, replace setInterval with a proper cron / BullMQ repeatable
 * job — same as pods.scheduler.ts.
 */

const MATCH_REFRESH_HOUR_UTC = 8;
const REFINE_USER_CAP_PER_RUN = 100;
const PER_USER_REFINE_LIMIT = 15;
const PER_USER_DELAY_MS = 500;

export interface DailyMatchesRun {
  usersScanned: number;
  rulesRefreshed: number;
  llmRefined: number;
  onboardingMembersTouched: number;
  onboardingReferralsAssigned: number;
  digestsSent: number;
  learningIntrosProcessed: number;
  errors: number;
}

const WEEKLY_DIGEST_DOW = 1; // Monday (0 = Sunday)

export async function runDailyMatchesRefresh(
  opts: { perUserDelayMs?: number; now?: Date; sendDigest?: boolean } = {},
): Promise<DailyMatchesRun> {
  const perUserDelayMs = opts.perUserDelayMs ?? PER_USER_DELAY_MS;
  const now = opts.now ?? new Date();
  const sendDigest = opts.sendDigest ?? now.getUTCDay() === WEEKLY_DIGEST_DOW;
  const stats: DailyMatchesRun = {
    usersScanned: 0,
    rulesRefreshed: 0,
    llmRefined: 0,
    onboardingMembersTouched: 0,
    onboardingReferralsAssigned: 0,
    digestsSent: 0,
    learningIntrosProcessed: 0,
    errors: 0,
  };

  const members = await prisma.memberProfile.findMany({
    where: { user: { deletedAt: null } },
    select: { userId: true },
    orderBy: { updatedAt: 'asc' },
  });

  stats.usersScanned = members.length;

  for (const { userId } of members) {
    try {
      await refreshSuggestionsForUser(userId);
      stats.rulesRefreshed++;
    } catch (err) {
      stats.errors++;
      // eslint-disable-next-line no-console
      console.error('[matches-scheduler] rules refresh failed for', userId, err);
    }
  }

  if (isLlmEnabled()) {
    const targets = members.slice(0, REFINE_USER_CAP_PER_RUN);
    for (const { userId } of targets) {
      try {
        const result = await refineSuggestionsForUser(userId, { limit: PER_USER_REFINE_LIMIT });
        stats.llmRefined += result.refined;
      } catch (err) {
        stats.errors++;
        // eslint-disable-next-line no-console
        console.error('[matches-scheduler] llm refine failed for', userId, err);
      }
      if (perUserDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, perUserDelayMs));
      }
    }
  }

  try {
    const onboarding = await topUpOnboardingReferralsForAllMembers();
    stats.onboardingMembersTouched = onboarding.membersTouched;
    stats.onboardingReferralsAssigned = onboarding.assigned;
  } catch (err) {
    stats.errors++;
    // eslint-disable-next-line no-console
    console.error('[matches-scheduler] onboarding top-up failed:', err);
  }

  if (sendDigest) {
    try {
      const digest = await sendWeeklyReferralDigestForAllMembers();
      stats.digestsSent = digest.emailsSent;
      stats.errors += digest.errors;
    } catch (err) {
      stats.errors++;
      // eslint-disable-next-line no-console
      console.error('[matches-scheduler] weekly digest failed:', err);
    }
  }

  try {
    const retrain = await retrainFromOutcomes();
    stats.learningIntrosProcessed = retrain.introsProcessed;
  } catch (err) {
    stats.errors++;
    // eslint-disable-next-line no-console
    console.error('[matches-scheduler] retrain failed:', err);
  }

  // eslint-disable-next-line no-console
  console.log('[matches-scheduler] daily run complete', stats);
  return stats;
}

export function startMatchesScheduler(): void {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === MATCH_REFRESH_HOUR_UTC && lastRunUtcDate !== today) {
      lastRunUtcDate = today;
      try {
        await runDailyMatchesRefresh();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[matches-scheduler] daily run failed:', err);
      }
    }
  }, 5 * 60 * 1000);

  // eslint-disable-next-line no-console
  console.log(
    `[matches-scheduler] started — runs daily at ${MATCH_REFRESH_HOUR_UTC}:00 UTC (LLM refinement ${isLlmEnabled() ? 'enabled' : 'disabled'})`,
  );
}

export function stopMatchesScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
