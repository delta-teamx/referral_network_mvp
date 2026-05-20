import { prisma } from '../../../config/prisma.js';

/**
 * Per-member networking analytics — what the brief calls "monthly stats:
 * intros requested, intros accepted, meetings booked, connections made".
 *
 * Returns one bucket per calendar month for the lookback window. The current
 * month is the last entry; older months precede it. Counts only events the
 * user is the sender or host of where it makes sense (intros sent, meetings
 * hosted) so the numbers reflect their own outreach rather than passive
 * receipts.
 */

export interface MonthBucket {
  monthStart: string;
  label: string;
  introsRequested: number;
  introsAccepted: number;
  meetingsBooked: number;
  connectionsMade: number;
}

export interface MemberAnalytics {
  months: MonthBucket[];
  totals: {
    introsRequested: number;
    introsAccepted: number;
    meetingsBooked: number;
    connectionsMade: number;
  };
}

export interface MemberRoi {
  introsReceived: number;
  meetingsBooked: number;
  dealsClosed: number;
  estimatedValue: number;
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});

export async function getMemberAnalytics(
  userId: string,
  opts: { months?: number; now?: Date } = {},
): Promise<MemberAnalytics> {
  const monthsBack = Math.max(1, Math.min(24, opts.months ?? 6));
  const now = opts.now ?? new Date();

  const firstMonthStart = startOfMonth(addMonths(now, -(monthsBack - 1)));
  const windowEnd = startOfMonth(addMonths(now, 1));

  const [introsRequested, introsAccepted, bookings, connections] = await Promise.all([
    prisma.introduction.findMany({
      where: {
        senderId: userId,
        requestedAt: { gte: firstMonthStart, lt: windowEnd },
      },
      select: { requestedAt: true },
    }),
    prisma.introduction.findMany({
      where: {
        OR: [{ senderId: userId }, { targetId: userId }],
        acceptedAt: { gte: firstMonthStart, lt: windowEnd },
      },
      select: { acceptedAt: true },
    }),
    prisma.bookingCall.findMany({
      where: {
        OR: [{ hostId: userId }, { guestId: userId }],
        status: 'confirmed',
        startsAt: { gte: firstMonthStart, lt: windowEnd },
      },
      select: { startsAt: true },
    }),
    prisma.businessConnection.findMany({
      where: {
        status: 'accepted',
        OR: [{ initiatorId: userId }, { targetId: userId }],
        acceptedAt: { gte: firstMonthStart, lt: windowEnd },
      },
      select: { acceptedAt: true },
    }),
  ]);

  const buckets: MonthBucket[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const monthStart = startOfMonth(addMonths(firstMonthStart, i));
    buckets.push({
      monthStart: monthStart.toISOString(),
      label: MONTH_LABEL_FORMATTER.format(monthStart),
      introsRequested: 0,
      introsAccepted: 0,
      meetingsBooked: 0,
      connectionsMade: 0,
    });
  }

  const indexOf = (d: Date) => {
    const idx =
      (d.getUTCFullYear() - firstMonthStart.getUTCFullYear()) * 12 +
      (d.getUTCMonth() - firstMonthStart.getUTCMonth());
    return idx >= 0 && idx < buckets.length ? idx : -1;
  };

  for (const row of introsRequested) {
    if (!row.requestedAt) continue;
    const idx = indexOf(row.requestedAt);
    if (idx >= 0) buckets[idx]!.introsRequested++;
  }
  for (const row of introsAccepted) {
    if (!row.acceptedAt) continue;
    const idx = indexOf(row.acceptedAt);
    if (idx >= 0) buckets[idx]!.introsAccepted++;
  }
  for (const row of bookings) {
    const idx = indexOf(row.startsAt);
    if (idx >= 0) buckets[idx]!.meetingsBooked++;
  }
  for (const row of connections) {
    if (!row.acceptedAt) continue;
    const idx = indexOf(row.acceptedAt);
    if (idx >= 0) buckets[idx]!.connectionsMade++;
  }

  const totals = buckets.reduce(
    (acc, b) => {
      acc.introsRequested += b.introsRequested;
      acc.introsAccepted += b.introsAccepted;
      acc.meetingsBooked += b.meetingsBooked;
      acc.connectionsMade += b.connectionsMade;
      return acc;
    },
    { introsRequested: 0, introsAccepted: 0, meetingsBooked: 0, connectionsMade: 0 },
  );

  return { months: buckets, totals };
}

/**
 * Lifetime ROI for the member-facing ROI dashboard. Returns the brief's
 * four metrics: total intros received as the target, meetings booked
 * (host or guest, confirmed), deals closed (intros marked outcome
 * "deal_closed"), and the summed dealValue.
 */
export async function getMemberRoi(userId: string): Promise<MemberRoi> {
  const [introsReceived, meetingsBooked, closedAgg] = await Promise.all([
    prisma.introduction.count({
      where: { targetId: userId, status: { in: ['requested', 'accepted', 'completed'] } },
    }),
    prisma.bookingCall.count({
      where: { OR: [{ hostId: userId }, { guestId: userId }], status: 'confirmed' },
    }),
    prisma.introduction.aggregate({
      where: {
        OR: [{ senderId: userId }, { targetId: userId }],
        outcome: 'deal_closed',
      },
      _count: { _all: true },
      _sum: { dealValue: true },
    }),
  ]);

  return {
    introsReceived,
    meetingsBooked,
    dealsClosed: closedAgg._count._all,
    estimatedValue: Number(closedAgg._sum.dealValue ?? 0),
  };
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
