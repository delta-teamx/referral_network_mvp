import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/prisma.js', () => ({
  prisma: {
    introduction: { findMany: vi.fn() },
    bookingCall: { findMany: vi.fn() },
    businessConnection: { findMany: vi.fn() },
  },
}));

import { getMemberAnalytics } from '../src/domains/matching/ai/analytics.service.js';
import { prisma } from '../src/config/prisma.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('getMemberAnalytics', () => {
  const NOW = new Date('2026-05-19T12:00:00Z');

  function setupCounts(opts: {
    requested?: Date[];
    accepted?: Date[];
    bookings?: Date[];
    connections?: Date[];
  }) {
    vi.mocked(prisma.introduction.findMany)
      .mockResolvedValueOnce((opts.requested ?? []).map((requestedAt) => ({ requestedAt })) as never)
      .mockResolvedValueOnce((opts.accepted ?? []).map((acceptedAt) => ({ acceptedAt })) as never);
    vi.mocked(prisma.bookingCall.findMany).mockResolvedValueOnce(
      (opts.bookings ?? []).map((startsAt) => ({ startsAt })) as never,
    );
    vi.mocked(prisma.businessConnection.findMany).mockResolvedValueOnce(
      (opts.connections ?? []).map((acceptedAt) => ({ acceptedAt })) as never,
    );
  }

  it('returns 6 month buckets ending at the current month', async () => {
    setupCounts({});
    const result = await getMemberAnalytics('u1', { months: 6, now: NOW });
    expect(result.months).toHaveLength(6);
    expect(result.months[0]!.monthStart).toBe('2025-12-01T00:00:00.000Z');
    expect(result.months[5]!.monthStart).toBe('2026-05-01T00:00:00.000Z');
  });

  it('buckets each metric into the right calendar month', async () => {
    setupCounts({
      requested: [
        new Date('2026-05-02T10:00:00Z'),
        new Date('2026-05-15T14:00:00Z'),
        new Date('2026-04-20T09:00:00Z'),
      ],
      accepted: [new Date('2026-05-10T11:00:00Z')],
      bookings: [
        new Date('2026-05-25T16:00:00Z'),
        new Date('2026-03-12T15:00:00Z'),
      ],
      connections: [new Date('2026-02-08T08:00:00Z')],
    });
    const result = await getMemberAnalytics('u1', { months: 6, now: NOW });

    const may = result.months.find((m) => m.label === 'May 2026')!;
    expect(may.introsRequested).toBe(2);
    expect(may.introsAccepted).toBe(1);
    expect(may.meetingsBooked).toBe(1);

    const april = result.months.find((m) => m.label === 'Apr 2026')!;
    expect(april.introsRequested).toBe(1);

    const march = result.months.find((m) => m.label === 'Mar 2026')!;
    expect(march.meetingsBooked).toBe(1);

    const february = result.months.find((m) => m.label === 'Feb 2026')!;
    expect(february.connectionsMade).toBe(1);
  });

  it('sums totals across the lookback window', async () => {
    setupCounts({
      requested: [new Date('2026-05-02Z'), new Date('2026-04-15Z')],
      accepted: [new Date('2026-05-10Z')],
      bookings: [new Date('2026-05-25Z'), new Date('2026-03-12Z')],
      connections: [new Date('2026-02-08Z')],
    });
    const result = await getMemberAnalytics('u1', { months: 6, now: NOW });
    expect(result.totals).toEqual({
      introsRequested: 2,
      introsAccepted: 1,
      meetingsBooked: 2,
      connectionsMade: 1,
    });
  });

  it('ignores events outside the lookback window', async () => {
    setupCounts({
      requested: [new Date('2024-01-01Z')],
    });
    const result = await getMemberAnalytics('u1', { months: 6, now: NOW });
    expect(result.totals.introsRequested).toBe(0);
  });
});
