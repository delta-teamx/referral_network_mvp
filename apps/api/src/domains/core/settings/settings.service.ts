import { prisma } from '../../../config/prisma.js';

/**
 * Admin-editable settings store. Anything the admin can tune at runtime (point
 * values, limits, reward definitions) lives here as a key -> JSON row, with a
 * code default as the fallback so a missing key never breaks the app.
 */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  } catch {
    // Table may not exist yet on a brand-new deploy (heals on boot) - never throw.
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

// ── Contribution Score point values ──────────────────────────────────────────

export const DEFAULT_CONTRIBUTION_POINTS = {
  referral_accepted: 5,
  referral_relevant: 20,
  referral_opportunity: 50,
  referral_business: 100,
} as const;

export type ContributionPointKey = keyof typeof DEFAULT_CONTRIBUTION_POINTS;
const CONTRIBUTION_POINTS_KEY = 'contribution_points';

/** Merged point config: admin overrides on top of code defaults. */
export async function getContributionPoints(): Promise<Record<ContributionPointKey, number>> {
  const override = await getSetting<Partial<Record<ContributionPointKey, number>>>(
    CONTRIBUTION_POINTS_KEY,
    {},
  );
  return { ...DEFAULT_CONTRIBUTION_POINTS, ...override };
}

/** Persist edited point values (only known keys, coerced to sane integers). */
export async function setContributionPoints(
  input: Partial<Record<ContributionPointKey, number>>,
): Promise<Record<ContributionPointKey, number>> {
  const current = await getContributionPoints();
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_CONTRIBUTION_POINTS) as ContributionPointKey[]) {
    const v = input[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      next[key] = Math.max(0, Math.min(100000, Math.round(v)));
    }
  }
  await setSetting(CONTRIBUTION_POINTS_KEY, next);
  return next;
}

// ── Spam detection rules (admin-tunable weights + thresholds) ─────────────────

/**
 * Weights and trigger thresholds for the spam scanner. Each rule contributes
 * its weight when its condition trips; a user is flagged once their total
 * score reaches `flagThreshold`. All values are admin-editable so the team can
 * loosen or tighten detection without a redeploy.
 */
export const DEFAULT_SPAM_RULES = {
  flagThreshold: 3,
  // Burst: many messages very soon after signup.
  burstWeight: 3,
  burstHours: 48,
  burstMsgs: 10,
  // High referral volume in a short window.
  referralsWeight: 3,
  referralsCount: 25,
  referralsDays: 30,
  // The same message text sent over and over.
  dupWeight: 3,
  dupCount: 3,
  // Lots of messages from an empty (photoless, bio-less) profile.
  emptyProfileWeight: 2,
  emptyProfileMsgs: 8,
  // Known disposable / throwaway email domain.
  disposableWeight: 2,
} as const;

export type SpamRuleKey = keyof typeof DEFAULT_SPAM_RULES;
const SPAM_RULES_KEY = 'spam_rules';

/** Merged spam config: admin overrides on top of code defaults. */
export async function getSpamRules(): Promise<Record<SpamRuleKey, number>> {
  const override = await getSetting<Partial<Record<SpamRuleKey, number>>>(SPAM_RULES_KEY, {});
  return { ...DEFAULT_SPAM_RULES, ...override };
}

/** Persist edited spam config (only known keys, coerced to sane integers). */
export async function setSpamRules(
  input: Partial<Record<SpamRuleKey, number>>,
): Promise<Record<SpamRuleKey, number>> {
  const current = await getSpamRules();
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_SPAM_RULES) as SpamRuleKey[]) {
    const v = input[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      next[key] = Math.max(0, Math.min(100000, Math.round(v)));
    }
  }
  await setSetting(SPAM_RULES_KEY, next);
  return next;
}

// ── Free-plan engagement limit (intro requests / new conversations) ───────────

const FREE_ENGAGEMENT_LIMIT_KEY = 'free_engagement_limit';
export const DEFAULT_FREE_ENGAGEMENT_LIMIT = 3;

export async function getFreeEngagementLimit(): Promise<number> {
  return getSetting<number>(FREE_ENGAGEMENT_LIMIT_KEY, DEFAULT_FREE_ENGAGEMENT_LIMIT);
}

export async function setFreeEngagementLimit(value: number): Promise<number> {
  const v = Math.max(0, Math.min(1000, Math.round(value)));
  await setSetting(FREE_ENGAGEMENT_LIMIT_KEY, v);
  return v;
}
