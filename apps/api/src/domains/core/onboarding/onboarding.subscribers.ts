import type { EventBus } from '../events/EventBus.js';
import { sendEmail } from '../notifications/email.service.js';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
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
          onboardingUrl: `${env.FRONTEND_URL.split(',')[0]}/onboarding`,
        },
      });
    }
  });

  // Once onboarding completes, persist completedAt and send the welcome
  // packet — a richer onboarding email with the concrete first-week actions
  // (profile polish, availability, matches). Also available at /dashboard/welcome
  // for members who want to revisit it.
  bus.subscribe('onboarding.completed', async ({ userId }) => {
    // eslint-disable-next-line no-console
    console.log(`[onboarding] user ${userId} completed onboarding`);
    await prisma.onboardingProgress.updateMany({
      where: { userId, completedAt: null },
      data: { completedAt: new Date() },
    });

    const user = await findUserById(userId);
    if (!user) return;
    const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
    await sendEmail({
      to: user.email,
      template: 'welcome_packet',
      data: {
        firstName: user.firstName,
        matchesUrl: `${origin.replace(/\/$/, '')}/dashboard/matches`,
        profileUrl: `${origin.replace(/\/$/, '')}/dashboard/settings`,
        availabilityUrl: `${origin.replace(/\/$/, '')}/dashboard/availability`,
      },
    });
  });
}
