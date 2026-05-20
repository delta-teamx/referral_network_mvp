import crypto from 'node:crypto';
import { branding } from '@refnet/shared';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { sendEmail } from '../core/notifications/email.service.js';
import { generateIcs } from '../integrations/ics.service.js';
import { sendDripifyDm, isDripifyEnabled } from '../integrations/dripify-client.js';

/**
 * Feature 3 — meeting invite (step 3 of the LinkedIn outreach sequence).
 *
 * Channel selection per prospect:
 *   1. Email — if we have prospect.email. Reuses SendGrid + .ics attachment.
 *   2. Dripify DM — if DRIPIFY_API_KEY is set. Sends a short LinkedIn message
 *      with the RSVP URL inline (LI DMs can't attach files).
 *   3. needs_manual — neither channel is available; status stays at
 *      "connected" and the prospect is flagged for human follow-up.
 *
 * Generates a unique rsvpToken per invite. Hitting GET /rsvp/:token (public)
 * flips status invited → attended_pending and shows a confirmation page.
 *
 * Idempotent: re-invoking on an already-invited prospect re-uses the
 * existing rsvpToken and refreshes invitedAt.
 */

export interface SendInviteResult {
  prospectId: string;
  channel: 'email' | 'dripify_dm' | 'manual';
  rsvpUrl: string;
  delivered: boolean;
  reason?: string;
}

export async function sendMeetingInvite(prospectId: string): Promise<SendInviteResult> {
  const prospect = await prisma.linkedInProspect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      fullName: true,
      email: true,
      linkedInUrl: true,
      status: true,
      rsvpToken: true,
      assignedGroup: {
        select: {
          id: true,
          name: true,
          events: {
            where: { date: { gte: new Date() } },
            orderBy: { date: 'asc' },
            take: 1,
            select: { id: true, title: true, date: true, meetingUrl: true, description: true },
          },
        },
      },
    },
  });
  if (!prospect) throw new Error('Prospect not found');
  if (!prospect.assignedGroup) {
    return {
      prospectId,
      channel: 'manual',
      rsvpUrl: '',
      delivered: false,
      reason: 'no_assigned_group',
    };
  }
  const nextMeeting = prospect.assignedGroup.events[0];
  if (!nextMeeting) {
    return {
      prospectId,
      channel: 'manual',
      rsvpUrl: '',
      delivered: false,
      reason: 'no_upcoming_meeting',
    };
  }

  const rsvpToken = prospect.rsvpToken ?? crypto.randomBytes(24).toString('hex');
  const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
  const rsvpUrl = `${origin.replace(/\/$/, '')}/rsvp/${rsvpToken}`;
  const firstName = prospect.fullName.split(' ')[0] ?? prospect.fullName;
  const whenLabel = nextMeeting.date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  let channel: SendInviteResult['channel'] = 'manual';
  let delivered = false;
  let reason: string | undefined;

  if (prospect.email) {
    const ics = generateIcs({
      uid: `linkedin-${prospectId}@nrg`,
      title: nextMeeting.title,
      description: nextMeeting.description ?? `RSVP: ${rsvpUrl}`,
      location: nextMeeting.meetingUrl ?? undefined,
      startsAt: nextMeeting.date,
      endsAt: new Date(nextMeeting.date.getTime() + 60 * 60_000),
    });
    try {
      await sendEmail({
        to: prospect.email,
        template: 'linkedin_meeting_invite',
        data: {
          firstName,
          groupName: prospect.assignedGroup.name,
          whenLabel,
          rsvpUrl,
          zoomUrl: nextMeeting.meetingUrl ?? '',
        },
        attachments: [
          {
            filename: 'nrg-meeting.ics',
            content: Buffer.from(ics, 'utf8').toString('base64'),
            contentType: 'text/calendar',
          },
        ],
      });
      channel = 'email';
      delivered = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[linkedin-outreach] email failed', err);
      reason = 'email_failed';
    }
  }

  if (!delivered && isDripifyEnabled()) {
    const result = await sendDripifyDm({
      linkedInUrl: prospect.linkedInUrl,
      message: buildDmBody({
        firstName,
        groupName: prospect.assignedGroup.name,
        whenLabel,
        rsvpUrl,
      }),
    });
    if (result.sent) {
      channel = 'dripify_dm';
      delivered = true;
    } else {
      reason = result.reason ?? 'dripify_failed';
    }
  }

  if (!delivered && channel === 'manual') {
    reason = reason ?? 'no_channel_available';
  }

  await prisma.linkedInProspect.update({
    where: { id: prospectId },
    data: {
      rsvpToken,
      invitedAt: delivered ? new Date() : null,
      invitedChannel: delivered ? channel : null,
      status: delivered ? 'invited' : prospect.status,
      lastTouchedAt: new Date(),
      invitedToEventId: nextMeeting.id,
    },
  });

  return { prospectId, channel, rsvpUrl, delivered, reason };
}

function buildDmBody(args: { firstName: string; groupName: string; whenLabel: string; rsvpUrl: string }): string {
  return `Hi ${args.firstName} — wanted to extend a quick invite to a ${args.groupName} meeting on ${args.whenLabel}. No pitch, no commitment — just a chance to see how ${branding.name} members refer business to each other. RSVP if you're in: ${args.rsvpUrl}`;
}

export async function processRsvp(token: string): Promise<{ ok: boolean; groupName?: string; whenLabel?: string }> {
  const prospect = await prisma.linkedInProspect.findUnique({
    where: { rsvpToken: token },
    select: {
      id: true,
      status: true,
      rsvpedAt: true,
      assignedGroup: {
        select: {
          name: true,
          events: {
            where: { date: { gte: new Date() } },
            orderBy: { date: 'asc' },
            take: 1,
            select: { date: true },
          },
        },
      },
    },
  });
  if (!prospect) return { ok: false };

  if (!prospect.rsvpedAt) {
    await prisma.linkedInProspect.update({
      where: { id: prospect.id },
      data: { rsvpedAt: new Date(), status: 'attended', lastTouchedAt: new Date() },
    });
  }

  const next = prospect.assignedGroup?.events[0];
  return {
    ok: true,
    groupName: prospect.assignedGroup?.name,
    whenLabel: next
      ? next.date.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : undefined,
  };
}

export interface BulkInviteResult {
  attempted: number;
  emailed: number;
  dripify: number;
  manual: number;
  errors: number;
}

export async function bulkSendInvites(prospectIds: string[]): Promise<BulkInviteResult> {
  const stats: BulkInviteResult = { attempted: 0, emailed: 0, dripify: 0, manual: 0, errors: 0 };
  for (const id of prospectIds) {
    stats.attempted++;
    try {
      const result = await sendMeetingInvite(id);
      if (result.delivered && result.channel === 'email') stats.emailed++;
      else if (result.delivered && result.channel === 'dripify_dm') stats.dripify++;
      else stats.manual++;
    } catch {
      stats.errors++;
    }
  }
  return stats;
}
