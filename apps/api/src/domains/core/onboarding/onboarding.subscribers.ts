import type { EventBus } from '../events/EventBus.js';
import { sendEmail } from '../notifications/email.service.js';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { ensureOnboardingRecord } from './onboarding.service.js';
import { findUserById } from '../users/users.service.js';
import { notifyAdminsOfSignup } from '../auth/auth.service.js';

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

  // Once onboarding completes: notify admins (with the member's INDUSTRY), once.
  bus.subscribe('onboarding.completed', async ({ userId }) => {
    // eslint-disable-next-line no-console
    console.log(`[onboarding] user ${userId} completed onboarding`);
    await prisma.onboardingProgress.updateMany({
      where: { userId, completedAt: null },
      data: { completedAt: new Date() },
    });

    // Admin new-member email - ONCE per member (onboarding.completed can fire on
    // later profile edits too, so we guard with a DomainEvent marker).
    try {
      await prisma.domainEvent.create({
        data: { id: `admin_notified:${userId}`, type: 'admin.new_member', aggregateId: userId, payload: {} },
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') return;
      throw err;
    }
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        memberProfile: { select: { industry: true, businessName: true } },
      },
    });
    // Don't notify admins about admin/staff/test accounts onboarding.
    if (!u || u.role === 'ADMIN') return;
    await notifyAdminsOfSignup({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      industry: u.memberProfile?.industry ?? null,
      businessName: u.memberProfile?.businessName ?? null,
    });
  });
}
