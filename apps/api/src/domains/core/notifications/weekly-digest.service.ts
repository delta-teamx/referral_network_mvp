import { prisma } from '../../../config/prisma.js';
import { sendEmailStrict } from './email.service.js';

/**
 * "Your week with Nova" - a proactive weekly briefing.
 *
 * Unlike the transactional digest (digest.service.ts, which batches unread
 * alerts for offline users), this is a scheduled Monday-morning summary voiced
 * by Nova, the platform's growth-partner persona. It pulls from data the member
 * already has - pending intros, fresh AI matches, pipeline momentum, things
 * going stale, and points earned - and ALWAYS ships: a quiet week becomes a
 * gentle nudge rather than silence.
 *
 * The scheduler calls this hourly; it only actually sends inside the Monday
 * 08:00-11:59 America/New_York window, and an idempotency row guarantees each
 * member gets exactly one briefing per ISO week even across restarts.
 */

const SEND_TZ = 'America/New_York';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Weekday (e.g. "Mon") + hour (0-23) as seen in the send timezone. */
function nowInSendTz(): { weekday: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SEND_TZ,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // Intl can emit "24" for midnight in hour12:false - normalize to 0.
  const hour = Number(hourRaw) % 24;
  return { weekday, hour };
}

/** Stable `YYYY-Www` ISO-week key for the current date (idempotency bucket). */
function isoWeekKey(d: Date): string {
  // ISO-8601 week number.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // shift to Thursday of this week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface WeeklyDigestData {
  firstName: string;
  quiet: boolean;
  network: { pendingIntros: number; pendingNames: string[]; newMatches: number; matchNames: string[] };
  momentum: { newLeads: number; advanced: number };
  attention: { staleCards: number; staleNames: string[]; agingIntros: number };
  standing: { weeklyPoints: number };
}

const fullName = (u: { firstName: string | null; lastName: string | null }): string =>
  `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'A member';

/**
 * Compute one member's weekly briefing from live data. Exported so it can be
 * previewed / tested without sending anything.
 */
export async function buildWeeklyDigest(userId: string): Promise<WeeklyDigestData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK_MS);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const TERMINAL = ['won', 'lost', 'dead'];

  const [
    user,
    pendingIntros,
    newMatches,
    newLeads,
    advanced,
    staleCards,
    agingIntros,
    points,
    // Real totals for the headline numbers (the findMany queries above cap at 5
    // for the NAME lists; counting their .length would under-report "9 waiting").
    pendingIntrosTotal,
    newMatchesTotal,
    staleCardsTotal,
  ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } }),
      // Intro requests waiting on THIS member's response.
      prisma.introduction.findMany({
        where: { targetId: userId, status: 'requested' },
        orderBy: { requestedAt: 'desc' },
        take: 5,
        select: { sender: { select: { firstName: true, lastName: true } } },
      }),
      // Fresh AI matches this week that involve this member.
      prisma.introduction.findMany({
        where: {
          status: 'suggested',
          createdAt: { gte: weekAgo },
          OR: [{ senderId: userId }, { targetId: userId }],
        },
        orderBy: { matchScore: 'desc' },
        take: 5,
        select: {
          senderId: true,
          sender: { select: { firstName: true, lastName: true } },
          target: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.pipelineCard.count({ where: { ownerId: userId, createdAt: { gte: weekAgo } } }),
      // Cards that moved forward this week (stage touched, past the initial 'new').
      prisma.pipelineCard.count({
        where: {
          ownerId: userId,
          stageUpdatedAt: { gte: weekAgo },
          stage: { notIn: ['new', ...TERMINAL] },
        },
      }),
      // Open cards that have gone quiet (no stage movement in 2+ weeks).
      prisma.pipelineCard.findMany({
        where: {
          ownerId: userId,
          stage: { notIn: TERMINAL },
          stageUpdatedAt: { lt: twoWeeksAgo },
        },
        orderBy: { stageUpdatedAt: 'asc' },
        take: 5,
        select: { name: true },
      }),
      // Intro requests that have been waiting on them for a few days.
      prisma.introduction.count({
        where: { targetId: userId, status: 'requested', requestedAt: { lt: threeDaysAgo } },
      }),
      prisma.contributionEvent.aggregate({
        where: { userId, occurredAt: { gte: weekAgo } },
        _sum: { points: true },
      }),
      // Accurate totals (not capped at 5) for the headline counts.
      prisma.introduction.count({ where: { targetId: userId, status: 'requested' } }),
      prisma.introduction.count({
        where: {
          status: 'suggested',
          createdAt: { gte: weekAgo },
          OR: [{ senderId: userId }, { targetId: userId }],
        },
      }),
      prisma.pipelineCard.count({
        where: { ownerId: userId, stage: { notIn: TERMINAL }, stageUpdatedAt: { lt: twoWeeksAgo } },
      }),
    ]);

  const pendingNames = pendingIntros.map((i) => fullName(i.sender));
  const matchNames = newMatches.map((m) =>
    fullName(m.senderId === userId ? m.target : m.sender),
  );
  const staleNames = staleCards.map((c) => c.name);
  const weeklyPoints = points._sum.points ?? 0;

  const data: WeeklyDigestData = {
    firstName: user?.firstName ?? 'there',
    quiet: false,
    network: {
      pendingIntros: pendingIntrosTotal,
      pendingNames,
      newMatches: newMatchesTotal,
      matchNames,
    },
    momentum: { newLeads, advanced },
    attention: { staleCards: staleCardsTotal, staleNames, agingIntros },
    standing: { weeklyPoints },
  };

  data.quiet =
    data.network.pendingIntros === 0 &&
    data.network.newMatches === 0 &&
    data.momentum.newLeads === 0 &&
    data.momentum.advanced === 0 &&
    data.attention.staleCards === 0 &&
    data.standing.weeklyPoints === 0;

  return data;
}

/**
 * Send the weekly briefing to every eligible member. Only sends inside the
 * Monday-morning window unless `force` is set (manual trigger / testing).
 */
export async function runWeeklyDigests(
  opts: { force?: boolean } = {},
): Promise<{ scanned: number; sent: number; skippedWindow?: boolean }> {
  if (!opts.force) {
    const { weekday, hour } = nowInSendTz();
    // Monday 08:00-11:59 local. The hourly job fires several times in-window;
    // the per-user idempotency row keeps it to one email each.
    if (weekday !== 'Mon' || hour < 8 || hour >= 12) {
      return { scanned: 0, sent: 0, skippedWindow: true };
    }
  }

  const weekKey = isoWeekKey(new Date());
  const settledBefore = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // Eligible members: real, verified, onboarded, non-admin, past their first
  // couple of days (let brand-new members settle before the first briefing).
  const members = await prisma.user.findMany({
    where: {
      deletedAt: null,
      emailVerified: true,
      role: { not: 'ADMIN' },
      createdAt: { lt: settledBefore },
      email: { not: '' },
      // "Onboarded" mirrors how the app derives it: finished onboarding OR has
      // a member profile. Keeps briefings out of half-set-up inboxes.
      OR: [
        { onboardingProgress: { completedAt: { not: null } } },
        { memberProfile: { isNot: null } },
      ],
    },
    select: { id: true, email: true },
  });

  let scanned = 0;
  let sent = 0;

  for (const m of members) {
    scanned++;
    // Idempotency: one briefing per member per ISO week. Claim the slot first;
    // a P2002 means we already sent this week, so skip.
    try {
      await prisma.domainEvent.create({
        data: {
          id: `weekly_digest:${m.id}:${weekKey}`,
          type: 'email.weekly_digest',
          aggregateId: m.id,
          payload: {},
        },
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') continue;
      // eslint-disable-next-line no-console
      console.error('[weekly-digest] idempotency claim failed', err);
      continue;
    }

    try {
      const data = await buildWeeklyDigest(m.id);
      await sendEmailStrict({ to: m.email, template: 'weekly_digest', data: { ...data } });
      sent++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[weekly-digest] send failed for ${m.id}`, err);
      // Roll back the week-slot claim so a later run inside the Monday window
      // retries this member - a transient provider blip (e.g. a 429) must not
      // silently drop their whole week's briefing.
      await prisma.domainEvent
        .delete({ where: { id: `weekly_digest:${m.id}:${weekKey}` } })
        .catch(() => undefined);
    }
  }

  return { scanned, sent };
}
