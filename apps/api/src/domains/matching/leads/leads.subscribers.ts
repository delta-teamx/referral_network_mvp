import type { EventBus } from '../../core/events/EventBus.js';
import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../../core/notifications/email.service.js';

/**
 * Lead notification subscribers — fire emails when a consumer creates
 * a lead and when a provider updates its status. Console email provider
 * in dev means these show up in the API's stdout; swap in SendGrid in
 * prod and the same flow sends real mail.
 */
export function registerLeadSubscribers(bus: EventBus): void {
  bus.subscribe('consumer_lead.created', async ({ leadId }) => {
    const lead = await prisma.consumerLead.findUnique({
      where: { id: leadId },
      select: {
        eventType: true,
        notes: true,
        consumer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        listing: {
          select: {
            name: true,
            slug: true,
            user: { select: { email: true, firstName: true } },
          },
        },
      },
    });
    if (!lead) return;

    await sendEmail({
      to: lead.listing.user.email,
      template: 'lead_received',
      data: {
        ownerFirstName: lead.listing.user.firstName,
        listingName: lead.listing.name,
        eventType: lead.eventType,
        consumerName: `${lead.consumer.firstName} ${lead.consumer.lastName}`,
        consumerEmail: lead.consumer.email,
        consumerPhone: lead.consumer.phone ?? '—',
        notes: lead.notes ?? '—',
      },
    });
  });
}
