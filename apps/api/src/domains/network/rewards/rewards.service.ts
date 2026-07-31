import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { getSetting, setSetting } from '../../core/settings/settings.service.js';
import { getMemberPointsSummary } from '../referral-tracking/referral-tracking.service.js';
import { createNotification } from '../../core/notifications/notifications.service.js';

/**
 * Rewards store - members spend earned Contribution points on TEMPORARY
 * unlocks (Premium days, a ranking boost, featured placement). Rewards expire
 * automatically (the scheduler reverts the effect), which is the point: let
 * members taste Premium value, then convert to paying. Spending is recorded as
 * a negative ContributionEvent so the balance stays consistent, and it never
 * lowers the earned reputation score.
 */

export type RewardType = 'premium' | 'boost' | 'featured';

export interface RewardDef {
  key: string;
  label: string;
  description: string;
  type: RewardType;
  cost: number;
  durationDays: number;
  enabled: boolean;
}

export const DEFAULT_REWARD_CATALOG: RewardDef[] = [
  {
    key: 'premium_7',
    label: '7 days of Premium',
    description: 'Unlock every Premium feature for a week.',
    type: 'premium',
    cost: 300,
    durationDays: 7,
    enabled: true,
  },
  {
    key: 'premium_30',
    label: '30 days of Premium',
    description: 'A full month of Premium access.',
    type: 'premium',
    cost: 1000,
    durationDays: 30,
    enabled: true,
  },
  {
    key: 'boost_7',
    label: '7-day ranking boost',
    description: "Rank higher in other members' AI matches for a week.",
    type: 'boost',
    cost: 150,
    durationDays: 7,
    enabled: true,
  },
  {
    key: 'featured_7',
    label: '7-day featured placement',
    description: 'Sit at the top of the member directory for a week.',
    type: 'featured',
    cost: 200,
    durationDays: 7,
    enabled: true,
  },
];

const REWARD_CATALOG_KEY = 'reward_catalog';

/** Catalog with admin overrides (cost / duration / enabled) applied per key. */
export async function getRewardCatalog(): Promise<RewardDef[]> {
  const override = await getSetting<Array<Partial<RewardDef>> | null>(REWARD_CATALOG_KEY, null);
  if (!override || !Array.isArray(override)) return DEFAULT_REWARD_CATALOG;
  return DEFAULT_REWARD_CATALOG.map((d) => {
    const o = override.find((x) => x.key === d.key);
    return o
      ? {
          ...d,
          cost: typeof o.cost === 'number' ? o.cost : d.cost,
          durationDays: typeof o.durationDays === 'number' ? o.durationDays : d.durationDays,
          enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
        }
      : d;
  });
}

/** Admin: persist edited catalog (only cost/duration/enabled per known key). */
export async function setRewardCatalog(
  items: Array<{ key: string; cost?: number; durationDays?: number; enabled?: boolean }>,
): Promise<RewardDef[]> {
  const catalog = DEFAULT_REWARD_CATALOG.map((d) => {
    const o = items.find((x) => x.key === d.key);
    return {
      ...d,
      cost: typeof o?.cost === 'number' ? Math.max(0, Math.round(o.cost)) : d.cost,
      durationDays: typeof o?.durationDays === 'number' ? Math.max(1, Math.round(o.durationDays)) : d.durationDays,
      enabled: typeof o?.enabled === 'boolean' ? o.enabled : d.enabled,
    };
  });
  await setSetting(REWARD_CATALOG_KEY, catalog);
  return catalog;
}

/** Member-facing store view: balance, buyable rewards, active unlocks. */
export async function getMemberRewards(userId: string) {
  const now = new Date();
  const [catalog, summary, active] = await Promise.all([
    getRewardCatalog(),
    getMemberPointsSummary(userId),
    prisma.rewardRedemption.findMany({
      where: { userId, status: 'active', expiresAt: { gt: now } },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, rewardKey: true, type: true, expiresAt: true },
    }),
  ]);
  return { balance: summary.balance, catalog: catalog.filter((r) => r.enabled), active };
}

/** Redeem a reward: spend points, record it, apply the temporary effect. */
export async function redeemReward(userId: string, rewardKey: string) {
  const catalog = await getRewardCatalog();
  const reward = catalog.find((r) => r.key === rewardKey && r.enabled);
  if (!reward) throw AppError.badRequest('That reward is not available.');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (reward.type === 'premium' && user.subscriptionTier !== 'FREE') {
    throw AppError.badRequest('You already have Premium features on your plan.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + reward.durationDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    // Serialize redeems per member so two quick clicks can't double-spend: the
    // advisory lock is held until this tx commits, so a second redeem blocks
    // here and then reads the balance AFTER this one's deduction lands.
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `reward:${userId}`);
    const { balance } = await getMemberPointsSummary(userId);
    if (balance < reward.cost) {
      throw AppError.badRequest(`You need ${reward.cost} points for this reward. You have ${balance}.`);
    }
    await tx.contributionEvent.create({
      data: {
        id: `reward_redemption:${userId}:${now.getTime()}`,
        userId,
        type: 'reward_redemption',
        points: -reward.cost,
        occurredAt: now,
      },
    });
    await tx.rewardRedemption.create({
      data: {
        userId,
        rewardKey: reward.key,
        type: reward.type,
        cost: reward.cost,
        startsAt: now,
        expiresAt,
        status: 'active',
        meta: reward.type === 'premium' ? { priorTier: user.subscriptionTier } : undefined,
      },
    });
    if (reward.type === 'premium') {
      await tx.user.update({ where: { id: userId }, data: { subscriptionTier: 'PREMIUM' } });
    }
  });

  void createNotification({
    userId,
    type: 'reward',
    title: `Reward unlocked: ${reward.label} 🎉`,
    body: `Active until ${expiresAt.toLocaleDateString()}. Enjoy it while it lasts.`,
    data: { rewardKey: reward.key },
  }).catch(() => undefined);

  return { ok: true, expiresAt };
}

/** Members currently holding an active reward of the given type. */
export async function activeRewardUserIds(type: RewardType): Promise<Set<string>> {
  const rows = await prisma.rewardRedemption.findMany({
    where: { type, status: 'active', expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Expire rewards whose time is up and revert their effects. For Premium, only
 * downgrade back to FREE if the member never started paying (no Stripe
 * customer) and has no other active Premium reward - so real subscribers are
 * never clobbered. Runs from the scheduler.
 */
export async function expireRewards(): Promise<{ expired: number }> {
  const now = new Date();
  const due = await prisma.rewardRedemption.findMany({
    where: { status: 'active', expiresAt: { lte: now } },
    select: { id: true, userId: true, type: true },
    take: 500,
  });
  let expired = 0;
  for (const r of due) {
    await prisma.rewardRedemption.update({ where: { id: r.id }, data: { status: 'expired' } });
    if (r.type === 'premium') {
      const [user, otherPremium] = await Promise.all([
        prisma.user.findUnique({
          where: { id: r.userId },
          select: { subscriptionTier: true, stripeCustomerId: true },
        }),
        prisma.rewardRedemption.findFirst({
          where: { userId: r.userId, type: 'premium', status: 'active', expiresAt: { gt: now } },
          select: { id: true },
        }),
      ]);
      if (user && user.subscriptionTier === 'PREMIUM' && !user.stripeCustomerId && !otherPremium) {
        await prisma.user.update({ where: { id: r.userId }, data: { subscriptionTier: 'FREE' } });
        void createNotification({
          userId: r.userId,
          type: 'reward',
          title: 'Your Premium trial ended',
          body: 'Keep Premium for good by upgrading, or earn another reward with referrals.',
          data: {},
        }).catch(() => undefined);
      }
    }
    expired += 1;
  }
  return { expired };
}
