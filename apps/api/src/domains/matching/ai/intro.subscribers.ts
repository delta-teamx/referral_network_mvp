import type { eventBus as EventBus } from '../../core/events/index.js';
import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { sendSms } from '../../core/notifications/sms.service.js';
import { autoBookFromIntro } from './intro-auto-book.service.js';

/**
 * Wires intro lifecycle events into downstream effects:
 *   - intro.requested → SMS + email to target (with accept/decline link),
 *     confirmation email to sender. Brief: "System sends automated SMS +
 *     email introduction to both parties."
 *   - intro.accepted → auto-book a Zoom call at the earliest mutual slot
 *     (handled by autoBookFromIntro; booking.created downstream emails the
 *     calendar invite + Zoom link).
 *
 * Both side-effects swallow per-channel failures so a missing phone number
 * or a transient SMS provider error doesn't break the API request that
 * triggered the event.
 */
export function registerIntroSubscribers(bus: typeof EventBus): void {
  bus.subscribe('intro.accepted', async (payload) => {
    await autoBookFromIntro({
      introId: payload.introId,
      hostUserId: payload.senderId,
      guestUserId: payload.targetId,
    });
  });

  bus.subscribe('intro.requested', async (payload) => {
    await sendIntroRequestedNotifications(payload);
  });
}

async function sendIntroRequestedNotifications(payload: {
  introId: string;
  senderId: string;
  targetId: string;
}): Promise<void> {
  const intro = await prisma.introduction.findUnique({
    where: { id: payload.introId },
    select: {
      id: true,
      reason: true,
      sender: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          memberProfile: { select: { businessName: true } },
        },
      },
      target: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          memberProfile: { select: { businessName: true } },
        },
      },
    },
  });
  if (!intro) return;

  const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
  const respondUrl = `${origin.replace(/\/$/, '')}/dashboard/matches?intro=${intro.id}`;

  const senderName = `${intro.sender.firstName} ${intro.sender.lastName}`.trim();
  const targetName = `${intro.target.firstName} ${intro.target.lastName}`.trim();
  const senderBusiness = intro.sender.memberProfile?.businessName ?? null;
  const targetBusiness = intro.target.memberProfile?.businessName ?? null;
  const reason = intro.reason ?? '';

  await Promise.allSettled([
    sendEmail({
      to: intro.target.email,
      template: 'intro_requested_target',
      data: { senderName, senderBusiness, reason, respondUrl },
    }),
    sendEmail({
      to: intro.sender.email,
      template: 'intro_requested_sender',
      data: { targetName, targetBusiness },
    }),
    sendSms({
      to: intro.target.phone ?? '',
      body: smsBody({ senderName, senderBusiness, respondUrl }),
    }),
  ]);
}

function smsBody(args: { senderName: string; senderBusiness: string | null; respondUrl: string }): string {
  const who = args.senderBusiness ? `${args.senderName} (${args.senderBusiness})` : args.senderName;
  return `NRG: ${who} wants an intro. Accept or decline: ${args.respondUrl}`;
}
