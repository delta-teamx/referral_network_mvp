import type { eventBus as EventBus } from '../../core/events/index.js';
import { assignOnboardingReferrals } from './onboarding-referrals.service.js';

/**
 * On onboarding completion, kick off the new member's first 10 curated
 * referrals (Feature 2). Months 2 and 3 are topped up by the daily matches
 * scheduler so we don't depend on a long-running boot-time process.
 *
 * Failures here are logged but never thrown — onboarding completion shouldn't
 * fail because the matching engine had a hiccup.
 */
export function registerOnboardingReferralSubscribers(bus: typeof EventBus): void {
  bus.subscribe('onboarding.completed', async ({ userId }) => {
    try {
      await assignOnboardingReferrals(userId, { month: 1 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[onboarding-referrals] month-1 assignment failed for', userId, err);
    }
  });
}
