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
      // Every genuine member counts toward the 200, including people who signed
      // up with Google (those accounts carry the CONSUMER role by default but
      // are real networking members). Only operator accounts and the seeded
      // demo network are excluded.
      role: { not: 'ADMIN' },
      NOT: { email: { endsWith: '@vpn-demo.com' } },
    },
  });
}

/**
 * Tier a brand-new account should be created with. Call this BEFORE inserting
 * the new user (the count reflects spots already taken).
 *
 * Only genuine BUSINESS accounts can claim a founding spot. Consumers and
 * admins are always FREE - previously ANY new account (incl. every Google/
 * consumer signup) was granted PREMIUM while not counting toward the 200, so
 * the promo leaked unlimited free Premium and never closed for consumers.
 */
export async function resolveSignupTier(role: string): Promise<'PREMIUM' | 'FREE'> {
  if (role === 'CONSUMER' || role === 'ADMIN') return 'FREE';
  const taken = await countFoundingMembers();
  return taken < FOUNDING_LIMIT ? FOUNDING_TIER : 'FREE';
}

/**
 * Tier for a new account created through social sign-in (Google). These are
 * genuine members even though they carry the default CONSUMER role, so they get
 * the founding grant while spots remain - previously EVERY Google signup was
 * forced to FREE (the OAuth path passed 'CONSUMER' to resolveSignupTier), which
 * is why real members who joined with Google showed up as free accounts.
 */
export async function resolveOAuthSignupTier(): Promise<'PREMIUM' | 'FREE'> {
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
