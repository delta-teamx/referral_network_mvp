import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    linkedInProspect: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../src/domains/core/notifications/email.service.js', () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock('../src/domains/integrations/ics.service.js', () => ({
  generateIcs: vi.fn(() => 'BEGIN:VCALENDAR\nEND:VCALENDAR'),
}));

vi.mock('../src/domains/integrations/dripify-client.js', () => ({
  sendDripifyDm: vi.fn(),
  isDripifyEnabled: vi.fn(),
}));

import { sendMeetingInvite } from '../src/domains/marketing/linkedin-outreach.service.js';
import { prisma } from '../src/config/prisma.js';
import { sendEmail } from '../src/domains/core/notifications/email.service.js';
import { isDripifyEnabled, sendDripifyDm } from '../src/domains/integrations/dripify-client.js';

afterEach(() => {
  vi.clearAllMocks();
});

function makeProspect(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    fullName: 'Alex Iverson',
    email: 'alex@example.com',
    linkedInUrl: 'https://linkedin.com/in/alex-iverson',
    status: 'connected',
    rsvpToken: null,
    assignedGroup: {
      id: 'g1',
      name: 'NRG Phoenix',
      events: [
        {
          id: 'e1',
          title: 'Weekly meeting',
          date: new Date('2026-06-01T16:00:00Z'),
          meetingUrl: 'https://zoom.us/abc',
          description: 'Come meet the chapter',
        },
      ],
    },
    ...overrides,
  };
}

describe('sendMeetingInvite', () => {
  it('sends via email when prospect has an email', async () => {
    vi.mocked(prisma.linkedInProspect.findUnique).mockResolvedValue(makeProspect() as never);
    vi.mocked(prisma.linkedInProspect.update).mockResolvedValue({} as never);
    vi.mocked(isDripifyEnabled).mockReturnValue(false);

    const result = await sendMeetingInvite('p1');

    expect(result.channel).toBe('email');
    expect(result.delivered).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(call.template).toBe('linkedin_meeting_invite');
    expect(call.attachments?.[0]?.filename).toBe('nrg-meeting.ics');
    expect(sendDripifyDm).not.toHaveBeenCalled();
    const updated = vi.mocked(prisma.linkedInProspect.update).mock.calls[0]![0];
    expect((updated.data as { status: string }).status).toBe('invited');
    expect((updated.data as { invitedChannel: string }).invitedChannel).toBe('email');
  });

  it('falls back to Dripify DM when no email is on file', async () => {
    vi.mocked(prisma.linkedInProspect.findUnique).mockResolvedValue(
      makeProspect({ email: null }) as never,
    );
    vi.mocked(prisma.linkedInProspect.update).mockResolvedValue({} as never);
    vi.mocked(isDripifyEnabled).mockReturnValue(true);
    vi.mocked(sendDripifyDm).mockResolvedValue({ sent: true, externalId: 'dm_1' });

    const result = await sendMeetingInvite('p1');

    expect(result.channel).toBe('dripify_dm');
    expect(result.delivered).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendDripifyDm).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(sendDripifyDm).mock.calls[0]![0];
    expect(arg.linkedInUrl).toContain('alex-iverson');
    expect(arg.message).toContain('NRG Phoenix');
    expect(arg.message).toContain('/rsvp/');
  });

  it('marks manual follow-up when neither channel is available', async () => {
    vi.mocked(prisma.linkedInProspect.findUnique).mockResolvedValue(
      makeProspect({ email: null }) as never,
    );
    vi.mocked(prisma.linkedInProspect.update).mockResolvedValue({} as never);
    vi.mocked(isDripifyEnabled).mockReturnValue(false);

    const result = await sendMeetingInvite('p1');

    expect(result.channel).toBe('manual');
    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_channel_available');
    const updated = vi.mocked(prisma.linkedInProspect.update).mock.calls[0]![0];
    expect((updated.data as { status?: string }).status).toBe('connected');
  });

  it('refuses to invite when no group meeting is scheduled', async () => {
    vi.mocked(prisma.linkedInProspect.findUnique).mockResolvedValue(
      makeProspect({ assignedGroup: { id: 'g1', name: 'NRG Phoenix', events: [] } }) as never,
    );

    const result = await sendMeetingInvite('p1');

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_upcoming_meeting');
    expect(prisma.linkedInProspect.update).not.toHaveBeenCalled();
  });

  it('returns no_assigned_group when the prospect has none', async () => {
    vi.mocked(prisma.linkedInProspect.findUnique).mockResolvedValue(
      makeProspect({ assignedGroup: null }) as never,
    );

    const result = await sendMeetingInvite('p1');

    expect(result.delivered).toBe(false);
    expect(result.reason).toBe('no_assigned_group');
  });
});
