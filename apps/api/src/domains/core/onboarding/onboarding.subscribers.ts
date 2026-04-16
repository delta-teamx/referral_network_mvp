import type { EventBus } from '../events/EventBus.js';
import { sendEmail } from '../notifications/email.service.js';
import { prisma } from '../../../config/prisma.js';
import { ensureOnboardingRecord } from './onboarding.service.js';
import { findUserById } from '../users/users.service.js';

/**
 * Event subscribers that belong to the onboarding domain. Registered once
 * at boot from `src/index.ts`. Kept in a dedicated file so the wiring is
 * grep-able without opening every domain's service.
 */
export function registerOnboardingSubscribers(bus: EventBus): void {
  // When a new user signs up, create their OnboardingProgress row and send
  // the welcome email (console-logs in dev).
  bus.subscribe('user.signed_up', async ({ userId, email }) => {
    await ensureOnboardingRecord(userId);

    const user = await findUserById(userId);
    if (user) {
      await sendEmail({
        to: email,
        template: 'welcome',
        data: {
          firstName: user.firstName,
          nextStep: 'Complete your profile to get matched with local pros.',
        },
      });
    }
  });

  // Once onboarding completes, optional audit log.
  bus.subscribe('onboarding.completed', async ({ userId }) => {
    // eslint-disable-next-line no-console
    console.log(`[onboarding] user ${userId} completed onboarding`);
    // Ensure the completedAt timestamp is persisted even if the service
    // call that triggered this event skipped it for some reason.
    await prisma.onboardingProgress.updateMany({
      where: { userId, completedAt: null },
      data: { completedAt: new Date() },
    });
  });
}
