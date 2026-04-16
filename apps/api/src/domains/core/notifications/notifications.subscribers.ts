import type { EventBus } from '../events/EventBus.js';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { sendEmail } from './email.service.js';

/**
 * Notification subscribers — turn domain events into outbound emails. Kept
 * separate from the services that publish the events so the hot path stays
 * fast and the side-effects stay testable.
 *
 * Register via `registerNotificationSubscribers(eventBus)` at boot.
 */

const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';

export function registerNotificationSubscribers(eventBus: EventBus): void {
  eventBus.subscribe('business_invitation.sent', async ({ invitationId, recipientEmail }) => {
    const inv = await prisma.businessInvitation.findUnique({
      where: { id: invitationId },
      select: {
        token: true,
        message: true,
        sender: { select: { firstName: true, lastName: true } },
      },
    });
    if (!inv) return;
    await sendEmail({
      to: recipientEmail,
      template: 'invitation',
      data: {
        senderName: `${inv.sender.firstName} ${inv.sender.lastName}`,
        message: inv.message,
        inviteUrl: `${origin}/invite?token=${inv.token}`,
      },
    });
  });

  eventBus.subscribe('referral.sent', async ({ referralId }) => {
    const ref = await prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        clientName: true,
        notes: true,
        sender: { select: { firstName: true, lastName: true } },
        receiver: { select: { email: true } },
      },
    });
    if (!ref) return;
    await sendEmail({
      to: ref.receiver.email,
      template: 'referral_received',
      data: {
        senderName: `${ref.sender.firstName} ${ref.sender.lastName}`,
        clientName: ref.clientName ?? 'Unnamed client',
        notes: ref.notes ?? '',
        referralUrl: `${origin}/dashboard/referrals`,
      },
    });
  });

  eventBus.subscribe('consumer_lead.created', async ({ leadId, listingId, eventType }) => {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { user: { select: { email: true } } },
    });
    if (!listing) return;
    await sendEmail({
      to: listing.user.email,
      template: 'lead_received',
      data: {
        eventType,
        leadId,
        leadUrl: `${origin}/dashboard/leads`,
      },
    });
  });
}
