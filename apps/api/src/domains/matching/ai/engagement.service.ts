import { prisma } from '../../../config/prisma.js';

/**
 * Per-member engagement score on a 0-100 scale. Drives the F6 retention
 * engine and the F4 bulk re-engagement campaign.
 *
 * Inputs (last 30 days):
 *   - logins: lastLoginAt (binary recency signal — within 30d worth +25)
 *   - introsRequested: 4 pts each, capped at 20
 *   - introsAccepted (as sender or target): 6 pts each, capped at 30
 *   - meetingsAttended: 8 pts each (BookingCall as host or guest), capped at 25
 *
 * Score reaches 100 quickly for active members; dormant members sit near 0.
 * Tunable constants are exported so admin tooling can show the breakdown.
 */

export const ENGAGEMENT_WEIGHTS = {
  recentLogin: 25,
  introRequestedPoints: 4,
  introRequestedCap: 20,
  introAcceptedPoints: 6,
  introAcceptedCap: 30,
  meetingPoints: 8,
  meetingCap: 25,
};

export const ENGAGEMENT_WINDOW_DAYS = 30;
export const DORMANT_THRESHOLD = 20;

export interface EngagementBreakdown {
  userId: string;
  score: number;
  signals: {
    recentLogin: boolean;
    introsRequested: number;
    introsAccepted: number;
    meetingsAttended: number;
  };
}

export async function computeEngagement(userId: string, now: Date = new Date()): Promise<EngagementBreakdown> {
  const since = new Date(now.getTime() - ENGAGEMENT_WINDOW_DAYS * 86400_000);
  const [user, requested, accepted, meetings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lastLoginAt: true } }),
    prisma.introduction.count({
      where: { senderId: userId, requestedAt: { gte: since } },
    }),
    prisma.introduction.count({
      where: {
        OR: [{ senderId: userId }, { targetId: userId }],
        acceptedAt: { gte: since },
      },
    }),
    prisma.bookingCall.count({
      where: {
        OR: [{ hostId: userId }, { guestId: userId }],
        status: 'confirmed',
        startsAt: { gte: since },
      },
    }),
  ]);

  const recentLogin = !!user?.lastLoginAt && user.lastLoginAt >= since;
  return scoreFromSignals(userId, { recentLogin, introsRequested: requested, introsAccepted: accepted, meetingsAttended: meetings });
}

export function scoreFromSignals(
  userId: string,
  signals: EngagementBreakdown['signals'],
): EngagementBreakdown {
  const W = ENGAGEMENT_WEIGHTS;
  const loginPts = signals.recentLogin ? W.recentLogin : 0;
  const reqPts = Math.min(W.introRequestedCap, signals.introsRequested * W.introRequestedPoints);
  const accPts = Math.min(W.introAcceptedCap, signals.introsAccepted * W.introAcceptedPoints);
  const meetPts = Math.min(W.meetingCap, signals.meetingsAttended * W.meetingPoints);
  const score = Math.max(0, Math.min(100, loginPts + reqPts + accPts + meetPts));
  return { userId, score, signals };
}

/**
 * Bulk engagement scan. Returns all active members with their scores so the
 * admin re-engagement view can sort them by dormancy.
 */
export async function listEngagementForAllMembers(now: Date = new Date()): Promise<EngagementBreakdown[]> {
  const members = await prisma.user.findMany({
    where: { deletedAt: null, memberProfile: { isNot: null } },
    select: { id: true, lastLoginAt: true },
  });
  if (members.length === 0) return [];

  const since = new Date(now.getTime() - ENGAGEMENT_WINDOW_DAYS * 86400_000);
  const userIds = members.map((m) => m.id);

  const [requestedRows, acceptedRows, meetingRows] = await Promise.all([
    prisma.introduction.groupBy({
      by: ['senderId'],
      where: { senderId: { in: userIds }, requestedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.introduction.findMany({
      where: {
        OR: [
          { senderId: { in: userIds } },
          { targetId: { in: userIds } },
        ],
        acceptedAt: { gte: since },
      },
      select: { senderId: true, targetId: true },
    }),
    prisma.bookingCall.findMany({
      where: {
        OR: [
          { hostId: { in: userIds } },
          { guestId: { in: userIds } },
        ],
        status: 'confirmed',
        startsAt: { gte: since },
      },
      select: { hostId: true, guestId: true },
    }),
  ]);

  const requestedByUser = new Map(requestedRows.map((r) => [r.senderId, r._count._all]));
  const acceptedByUser = new Map<string, number>();
  for (const row of acceptedRows) {
    for (const uid of [row.senderId, row.targetId]) {
      acceptedByUser.set(uid, (acceptedByUser.get(uid) ?? 0) + 1);
    }
  }
  const meetingsByUser = new Map<string, number>();
  for (const row of meetingRows) {
    for (const uid of [row.hostId, row.guestId]) {
      meetingsByUser.set(uid, (meetingsByUser.get(uid) ?? 0) + 1);
    }
  }

  return members.map((m) => {
    const signals: EngagementBreakdown['signals'] = {
      recentLogin: !!m.lastLoginAt && m.lastLoginAt >= since,
      introsRequested: requestedByUser.get(m.id) ?? 0,
      introsAccepted: acceptedByUser.get(m.id) ?? 0,
      meetingsAttended: meetingsByUser.get(m.id) ?? 0,
    };
    return scoreFromSignals(m.id, signals);
  });
}
