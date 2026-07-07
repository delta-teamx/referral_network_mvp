import { prisma } from '../../config/prisma.js';

/**
 * Founding-member promo.
 *
 * The first {@link FOUNDING_LIMIT} genuine sign-ups are treated as paid
 * members: they are granted the top (PREMIUM) tier at account creation, so
 * every paid feature is unlocked for them with no subscription. Sign-up
 * number {@link FOUNDING_LIMIT}+1 and onward fall back to FREE and must
 * upgrade normally.
 *
 * "Genuine" excludes admins, the seeded demo network (@vpn-demo.com) and
 * soft-deleted accounts, so the 200 spots go to real business owners.
 */
export const FOUNDING_LIMIT = 200;
export const FOUNDING_TIER = 'PREMIUM' as const;

/** How many founding spots have already been claimed. */
export async function countFoundingMembers(): Promise<number> {
  return prisma.user.count({
    where: {
      deletedAt: null,
      role: { not: 'ADMIN' },
      NOT: { email: { endsWith: '@vpn-demo.com' } },
    },
  });
}

/**
 * Tier a brand-new account should be created with. Call this BEFORE inserting
 * the new user (the count reflects spots already taken).
 */
export async function resolveSignupTier(): Promise<'PREMIUM' | 'FREE'> {
  const taken = await countFoundingMembers();
  return taken < FOUNDING_LIMIT ? FOUNDING_TIER : 'FREE';
}

export interface FoundingStatus {
  limit: number;
  taken: number;
  remaining: number;
  isOpen: boolean;
}

/** Public promo status for the marketing banner ("X of 200 spots left"). */
export async function getFoundingStatus(): Promise<FoundingStatus> {
  const taken = await countFoundingMembers();
  const remaining = Math.max(0, FOUNDING_LIMIT - taken);
  return { limit: FOUNDING_LIMIT, taken, remaining, isOpen: remaining > 0 };
}
