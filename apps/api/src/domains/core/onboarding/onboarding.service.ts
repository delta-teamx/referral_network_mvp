import type { OnboardingStartInput } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';
import { eventBus } from '../events/index.js';

/**
 * Onboarding — drives the first-session experience the architecture review
 * called for (retention lever): capture goals, auto-suggest 3–5 businesses
 * to connect with, mark steps complete, fire events so downstream systems
 * (welcome email, dashboard checklist) can react.
 *
 * Steps:
 *   1. `started`              — row created at signup via event subscriber
 *   2. `profile_submitted`    — user entered zip + category + goals
 *   3. `first_connection`     — suggestion accepted (Branch 4 wires this)
 *   4. `first_referral`       — optional booster step (Branch 4)
 *   5. `completed`            — all required steps done
 */

export const REQUIRED_STEPS = ['profile_submitted'] as const;

export async function ensureOnboardingRecord(userId: string): Promise<void> {
  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: { userId, completedSteps: [] },
    update: {},
  });
}

export async function getOnboardingStatus(userId: string) {
  return prisma.onboardingProgress.findUnique({ where: { userId } });
}

export async function submitProfile(userId: string, input: OnboardingStartInput): Promise<void> {
  const existing = await prisma.onboardingProgress.findUnique({ where: { userId } });
  const steps = new Set<string>(
    Array.isArray(existing?.completedSteps) ? (existing.completedSteps as string[]) : [],
  );
  steps.add('profile_submitted');

  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: {
      userId,
      zip: input.zip,
      primaryCategoryId: await resolveCategoryIdBySlug(input.primaryCategorySlug),
      goals: input.goals,
      completedSteps: Array.from(steps),
    },
    update: {
      zip: input.zip,
      primaryCategoryId: await resolveCategoryIdBySlug(input.primaryCategorySlug),
      goals: input.goals,
      completedSteps: Array.from(steps),
    },
  });

  await eventBus.publish('onboarding.step_completed', {
    userId,
    step: 'profile_submitted',
  });

  await maybeMarkCompleted(userId, Array.from(steps));
}

export async function markStepCompleted(userId: string, step: string): Promise<void> {
  const existing = await prisma.onboardingProgress.findUnique({ where: { userId } });
  const steps = new Set<string>(
    Array.isArray(existing?.completedSteps) ? (existing.completedSteps as string[]) : [],
  );
  if (steps.has(step)) return;
  steps.add(step);

  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: { userId, completedSteps: Array.from(steps) },
    update: { completedSteps: Array.from(steps) },
  });

  await eventBus.publish('onboarding.step_completed', { userId, step });
  await maybeMarkCompleted(userId, Array.from(steps));
}

/**
 * Stub suggestion generator for Branch 2 — returns up to N listings whose
 * city matches the user's zip's city (no geo query yet; Branch 3 adds the
 * proper radius search). Returns an empty list if no matches, which is
 * acceptable for a brand-new deployment with empty data.
 */
export async function suggestConnections(userId: string, limit = 5) {
  const progress = await prisma.onboardingProgress.findUnique({ where: { userId } });
  if (!progress?.zip) return [];

  // Branch 2 simple: match by first-3-digits of zip prefix on Listing.zipCode.
  // Branch 3 replaces with real geo-radius via PostGIS.
  const zipPrefix = progress.zip.slice(0, 3);

  return prisma.listing.findMany({
    where: {
      zipCode: { startsWith: zipPrefix },
      status: 'ACTIVE',
      deletedAt: null,
    },
    take: limit,
    orderBy: [{ trustScore: 'desc' }, { avgRating: 'desc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      city: true,
      state: true,
      avgRating: true,
      reviewCount: true,
      isVerified: true,
      category: { select: { name: true, slug: true } },
    },
  });
}

// ---- internals ---------------------------------------------------------------

async function resolveCategoryIdBySlug(slug: string): Promise<string | null> {
  const cat = await prisma.category.findUnique({ where: { slug } });
  return cat?.id ?? null;
}

async function maybeMarkCompleted(userId: string, completedSteps: string[]): Promise<void> {
  const allDone = REQUIRED_STEPS.every((s) => completedSteps.includes(s));
  if (!allDone) return;

  const record = await prisma.onboardingProgress.findUnique({ where: { userId } });
  if (record?.completedAt) return; // already marked

  await prisma.onboardingProgress.update({
    where: { userId },
    data: { completedAt: new Date() },
  });
  await eventBus.publish('onboarding.completed', { userId });
}
