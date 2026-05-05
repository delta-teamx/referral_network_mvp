import type { EventBus } from '../../core/events/EventBus.js';
import { linkReferralOnSignup, markReferralOnboarded, grantReferralReward } from './referral-tracking.service.js';

export function registerReferralTrackingSubscribers(eventBus: EventBus): void {
  eventBus.subscribe('user.signed_up', async ({ userId, email }) => {
    await linkReferralOnSignup(userId, email);
  });

  eventBus.subscribe('onboarding.completed', async ({ userId }) => {
    await markReferralOnboarded(userId);
  });

  eventBus.subscribe('subscription.activated', async ({ userId, tier }) => {
    await grantReferralReward(userId, tier);
  });
}
