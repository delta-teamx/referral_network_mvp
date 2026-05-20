import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    introduction: { findMany: vi.fn() },
  },
}));

vi.mock('../src/domains/core/notifications/email.service.js', () => ({
  sendEmail: vi.fn(async () => undefined),
}));

import {
  DIGEST_LIMIT,
  sendWeeklyReferralDigest,
  sendWeeklyReferralDigestForAllMembers,
} from '../src/domains/matching/ai/referral-digest.service.js';
import { prisma } from '../src/config/prisma.js';
import { sendEmail } from '../src/domains/core/notifications/email.service.js';

afterEach(() => {
  vi.clearAllMocks();
});

function makeSuggestion(i: number) {
  return {
    id: `intro_${i}`,
    matchScore: 90 - i,
    reason: `Solid match because ${i}`,
    target: {
      firstName: `Alice${i}`,
      lastName: 'Smith',
      memberProfile: {
        businessName: `Biz ${i}`,
        industry: 'Plumbing',
        city: 'Phoenix',
        state: 'AZ',
      },
    },
  };
}

describe('sendWeeklyReferralDigest', () => {
  it('sends the email when the member has at least one suggested intro', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'a@b.com',
      firstName: 'Alex',
      deletedAt: null,
    } as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue(
      [makeSuggestion(0), makeSuggestion(1)] as never,
    );

    const sent = await sendWeeklyReferralDigest('u1');

    expect(sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(call.template).toBe('weekly_referral_digest');
    expect(call.to).toBe('a@b.com');
    const items = (call.data as { items: unknown[] }).items;
    expect(items).toHaveLength(2);
  });

  it('skips the email when the member has no active suggestions', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'a@b.com',
      firstName: 'Alex',
      deletedAt: null,
    } as never);
    vi.mocked(prisma.introduction.findMany).mockResolvedValue([] as never);

    const sent = await sendWeeklyReferralDigest('u1');

    expect(sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('caps the digest at DIGEST_LIMIT items', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'a@b.com',
      firstName: 'Alex',
      deletedAt: null,
    } as never);
    // service passes `take: DIGEST_LIMIT` to prisma — we don't enforce here,
    // but the contract is that we never exceed DIGEST_LIMIT.
    vi.mocked(prisma.introduction.findMany).mockResolvedValue(
      Array.from({ length: DIGEST_LIMIT }, (_, i) => makeSuggestion(i)) as never,
    );

    await sendWeeklyReferralDigest('u1');

    const findManyCall = vi.mocked(prisma.introduction.findMany).mock.calls[0]![0];
    expect((findManyCall as { take: number }).take).toBe(DIGEST_LIMIT);
  });

  it('returns false for deleted users', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'a@b.com',
      firstName: 'Alex',
      deletedAt: new Date(),
    } as never);

    const sent = await sendWeeklyReferralDigest('u1');

    expect(sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('sendWeeklyReferralDigestForAllMembers', () => {
  it('aggregates emailsSent / skippedEmpty / errors across members', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', email: 'a@b.com', firstName: 'A' },
      { id: 'u2', email: 'c@d.com', firstName: 'C' },
      { id: 'u3', email: 'e@f.com', firstName: 'E' },
    ] as never);

    vi.mocked(prisma.user.findUnique)
      // u1: has suggestions
      .mockResolvedValueOnce({ email: 'a@b.com', firstName: 'A', deletedAt: null } as never)
      // u2: empty
      .mockResolvedValueOnce({ email: 'c@d.com', firstName: 'C', deletedAt: null } as never)
      // u3: errors thrown by findMany
      .mockResolvedValueOnce({ email: 'e@f.com', firstName: 'E', deletedAt: null } as never);

    vi.mocked(prisma.introduction.findMany)
      .mockResolvedValueOnce([makeSuggestion(0)] as never)
      .mockResolvedValueOnce([] as never)
      .mockRejectedValueOnce(new Error('db down'));

    const stats = await sendWeeklyReferralDigestForAllMembers();

    expect(stats.membersConsidered).toBe(3);
    expect(stats.emailsSent).toBe(1);
    expect(stats.skippedEmpty).toBe(1);
    expect(stats.errors).toBe(1);
  });
});
