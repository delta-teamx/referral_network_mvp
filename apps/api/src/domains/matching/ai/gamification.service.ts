import { prisma } from '../../../config/prisma.js';
import { listEngagementForAllMembers } from './engagement.service.js';

/**
 * Feature 6 gamification: leaderboard, streaks, badges. All computed
 * on-the-fly from existing rows — no new tables.
 */

export interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  businessName: string | null;
  score: number;
  intros: number;
  meetings: number;
}

export async function getMonthlyLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const engagement = await listEngagementForAllMembers();
  if (engagement.length === 0) return [];

  const ranked = engagement.sort((a, b) => b.score - a.score).slice(0, limit);
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((r) => r.userId) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      memberProfile: { select: { businessName: true } },
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return ranked
    .map((r) => {
      const u = userMap.get(r.userId);
      if (!u) return null;
      return {
        userId: r.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: u.avatarUrl,
        businessName: u.memberProfile?.businessName ?? null,
        score: r.score,
        intros: r.signals.introsRequested + r.signals.introsAccepted,
        meetings: r.signals.meetingsAttended,
      } satisfies LeaderboardEntry;
    })
    .filter((e): e is LeaderboardEntry => e !== null);
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface MemberBadgeReport {
  userId: string;
  badges: Badge[];
  earnedCount: number;
}

const BADGE_TIERS: Array<{ id: string; label: string; description: string; metric: 'intros' | 'connections' | 'meetings' | 'deals'; target: number }> = [
  { id: 'intros_10', label: 'Connector', description: '10 intros requested', metric: 'intros', target: 10 },
  { id: 'intros_50', label: 'Super Connector', description: '50 intros requested', metric: 'intros', target: 50 },
  { id: 'connections_10', label: 'Network builder', description: '10 confirmed connections', metric: 'connections', target: 10 },
  { id: 'connections_50', label: 'Network powerhouse', description: '50 confirmed connections', metric: 'connections', target: 50 },
  { id: 'meetings_5', label: 'Meeting maker', description: '5 meetings attended', metric: 'meetings', target: 5 },
  { id: 'meetings_25', label: 'Meeting maven', description: '25 meetings attended', metric: 'meetings', target: 25 },
  { id: 'deals_1', label: 'First close', description: 'Closed your first deal', metric: 'deals', target: 1 },
  { id: 'deals_10', label: 'Closer', description: '10 closed deals', metric: 'deals', target: 10 },
];

export async function getMemberBadges(userId: string): Promise<MemberBadgeReport> {
  const [intros, connections, meetings, deals] = await Promise.all([
    prisma.introduction.count({
      where: { senderId: userId, status: { in: ['requested', 'accepted', 'completed'] } },
    }),
    prisma.businessConnection.count({
      where: { status: 'accepted', OR: [{ initiatorId: userId }, { targetId: userId }] },
    }),
    prisma.bookingCall.count({
      where: { status: 'confirmed', OR: [{ hostId: userId }, { guestId: userId }] },
    }),
    prisma.introduction.count({
      where: { OR: [{ senderId: userId }, { targetId: userId }], outcome: 'deal_closed' },
    }),
  ]);

  const counts: Record<string, number> = { intros, connections, meetings, deals };

  const badges: Badge[] = BADGE_TIERS.map((b) => {
    const progress = counts[b.metric] ?? 0;
    return {
      id: b.id,
      label: b.label,
      description: b.description,
      target: b.target,
      progress,
      earned: progress >= b.target,
    };
  });

  return {
    userId,
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
  };
}

/**
 * Login streak: consecutive ISO weeks the member has logged in at least
 * once. Backed by LoginEvent rows. Walks the last 90 days of events,
 * bucketed into week-of-year, and counts consecutive weeks ending in the
 * current week. Returns 0 if the current week has no login (a missed
 * week resets the streak — the brief calls these "activity streaks").
 */
export async function getMemberStreak(
  userId: string,
  now: Date = new Date(),
): Promise<{ weeks: number; activeThisWeek: boolean }> {
  const since = new Date(now.getTime() - 90 * 86400_000);
  const events = await prisma.loginEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    select: { occurredAt: true },
    orderBy: { occurredAt: 'desc' },
  });
  if (events.length === 0) return { weeks: 0, activeThisWeek: false };

  const currentWeekKey = isoWeekKey(now);
  const weekKeys = new Set(events.map((e) => isoWeekKey(e.occurredAt)));

  const activeThisWeek = weekKeys.has(currentWeekKey);
  if (!activeThisWeek) return { weeks: 0, activeThisWeek: false };

  let weeks = 0;
  let cursor = startOfIsoWeek(now);
  while (weekKeys.has(isoWeekKey(cursor))) {
    weeks++;
    cursor = new Date(cursor.getTime() - 7 * 86400_000);
  }
  return { weeks, activeThisWeek };
}

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = date.getUTCDay();
  const diff = (dow + 6) % 7; // Monday-start
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function isoWeekKey(d: Date): string {
  const start = startOfIsoWeek(d);
  return `${start.getUTCFullYear()}-${start.getUTCMonth() + 1}-${start.getUTCDate()}`;
}
