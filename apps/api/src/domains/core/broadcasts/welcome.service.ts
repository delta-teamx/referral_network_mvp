import { prisma } from '../../../config/prisma.js';
import { getSetting, setSetting } from '../settings/settings.service.js';
import { sendEmail } from '../notifications/email.service.js';
import { deliverBroadcastToMember } from '../../network/messaging/messaging.service.js';

/**
 * New-member welcome.
 *
 * When a member finishes onboarding we send them ONE welcome - in their
 * Messages inbox (a one-way "Referral Nova" message, same rail as
 * announcements, so it never touches the pipeline or analytics) plus an email.
 * The text is admin-editable from the Announcements console; a code default is
 * used until edited. Firing once-per-member is enforced by the caller
 * (onboarding subscriber) via a DomainEvent marker.
 */

export interface WelcomeConfig {
  enabled: boolean;
  subject: string;
  body: string;
}

export const DEFAULT_WELCOME: WelcomeConfig = {
  enabled: true,
  subject: 'Welcome to Referral Nova! 🎉',
  body: `We're thrilled to have you in the network. Referral Nova connects you with trusted, complementary businesses so real referrals flow both ways.

Here's how to get the most out of it:
• Complete your profile - the more detail you add, the better your AI matches.
• Review your suggested introductions and send your first intro request.
• Book a quick Zoom call with a match to start building the relationship.

Need a hand? Our support assistant ROUL is one click away from the help button in your dashboard.

Welcome aboard - here's to your next great referral!`,
};

const WELCOME_KEY = 'welcome_message';

/** Merged welcome config: admin overrides on top of the code default. */
export async function getWelcomeMessage(): Promise<WelcomeConfig> {
  const override = await getSetting<Partial<WelcomeConfig>>(WELCOME_KEY, {});
  return { ...DEFAULT_WELCOME, ...override };
}

/** Persist edited welcome config (validated + bounded). */
export async function setWelcomeMessage(input: Partial<WelcomeConfig>): Promise<WelcomeConfig> {
  const current = await getWelcomeMessage();
  const next: WelcomeConfig = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    subject:
      typeof input.subject === 'string' && input.subject.trim()
        ? input.subject.trim().slice(0, 160)
        : current.subject,
    body:
      typeof input.body === 'string' && input.body.trim()
        ? input.body.trim().slice(0, 5000)
        : current.body,
  };
  await setSetting(WELCOME_KEY, next);
  return next;
}

/**
 * Send the welcome to a member (in-app + email). Best-effort throughout: a
 * failure in one channel never blocks the other, and this never throws.
 * Skips admin/system accounts. Idempotency is the caller's responsibility.
 */
export async function sendWelcomeToMember(userId: string): Promise<void> {
  const cfg = await getWelcomeMessage();
  if (!cfg.enabled) return;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, firstName: true, email: true, role: true },
  });
  // Never welcome admin/staff/system accounts (ROUL, announcer, admins).
  if (!user || user.role === 'ADMIN') return;

  const firstName = user.firstName || 'there';
  const threadText = `👋 ${cfg.subject}\n\n${cfg.body}\n\n— The Referral Nova Team`;

  // In-app: lands in the one-way "Referral Nova" thread (pipeline-excluded).
  try {
    await deliverBroadcastToMember(user.id, threadText);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[welcome] in-app delivery failed:', String(err).slice(0, 200));
  }

  // Email.
  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        template: 'member_welcome',
        data: { firstName, subject: cfg.subject, message: cfg.body },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[welcome] email failed:', String(err).slice(0, 200));
    }
  }
}
