import { prisma } from '../../../config/prisma.js';
import { sendEmail } from './email.service.js';

/**
 * Re-engagement email sweep.
 *
 * Members who signed up but haven't been active for 3 / 7 / 14 days get a
 * nudge to come back and finish setting up. Each stage is sent at most ONCE per
 * member (idempotency marker in DomainEvent, so concurrent instances and repeat
 * sweeps never double-send). A member who returns updates lastLoginAt (see
 * auth.refresh) and drops out of the sweep automatically. After 28 days of
 * inactivity we stop nudging.
 *
 * Runs from the jobs scheduler (every few hours). Safe to run often - the
 * markers make it idempotent.
 */

const DAY = 24 * 60 * 60 * 1000;
const STAGE_DAYS = [3, 7, 14] as const;
const STOP_AFTER_DAYS = 28;
const BATCH = 2000;

/**
 * Nurture emails go to real members ONLY - never to admins, staff, or demo/test
 * accounts. Admins are excluded by role; internal/demo email domains are
 * excluded here too as a second guard.
 */
const INTERNAL_DOMAINS = ['@vpn-demo.com', '@virtualpros.com', '@referralnova.com'];
const AUDIENCE_GUARD = {
  role: { not: 'ADMIN' as const },
  NOT: { OR: INTERNAL_DOMAINS.map((d) => ({ email: { endsWith: d } })) },
};

type Stage = (typeof STAGE_DAYS)[number];

/** Which stage a member with `daysInactive` should currently receive (or null). */
function stageFor(daysInactive: number): Stage | null {
  if (daysInactive >= STOP_AFTER_DAYS) return null;
  if (daysInactive >= 14) return 14;
  if (daysInactive >= 7) return 7;
  if (daysInactive >= 3) return 3;
  return null;
}

export interface ReengagementResult {
  scanned: number;
  sent: number;
  /** In dryRun mode, who WOULD be emailed (no send, no marker written). */
  preview?: { email: string; stage: Stage; daysInactive: number }[];
}

export async function runReengagementSweep(
  opts: { dryRun?: boolean } = {},
): Promise<ReengagementResult> {
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * DAY);
  const preview: { email: string; stage: Stage; daysInactive: number }[] = [];

  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...AUDIENCE_GUARD, // members only - no admins/staff/demo
      // FOLLOW-UP ONLY for members who FULLY set up (profile + photo) and then
      // went quiet. Requiring a photo keeps this cleanly separate from the
      // profile-completion reminder below (which targets incomplete profiles).
      memberProfile: { photoUrl: { not: null } },
      // Inactive for at least 3 days (never-returned falls back to createdAt).
      OR: [
        { lastLoginAt: { lte: threeDaysAgo } },
        { lastLoginAt: null, createdAt: { lte: threeDaysAgo } },
      ],
    },
    select: { id: true, email: true, firstName: true, lastLoginAt: true, createdAt: true },
    take: BATCH,
    orderBy: { createdAt: 'asc' },
  });

  let sent = 0;
  for (const u of candidates) {
    const inactiveSince = (u.lastLoginAt ?? u.createdAt).getTime();
    const daysInactive = Math.floor((now - inactiveSince) / DAY);
    const stage = stageFor(daysInactive);
    if (!stage) continue;

    if (opts.dryRun) {
      // Only show stages that haven't already been sent, so the preview matches
      // what a real run would do.
      const already = await prisma.domainEvent.findUnique({
        where: { id: `reengage:${u.id}:d${stage}` },
        select: { id: true },
      });
      if (!already) preview.push({ email: u.email, stage, daysInactive });
      continue;
    }

    // Claim the once-per-stage marker atomically; skip if already sent.
    const markerId = `reengage:${u.id}:d${stage}`;
    try {
      await prisma.domainEvent.create({
        data: { id: markerId, type: 'email.reengagement', aggregateId: u.id, payload: { stage } },
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') continue;
      throw err;
    }

    await sendEmail({
      to: u.email,
      template: 'reengagement',
      data: { firstName: u.firstName, stage },
    });
    sent += 1;
  }

  if (candidates.length === BATCH) {
    // eslint-disable-next-line no-console
    console.log(`[reengagement] hit the ${BATCH} batch cap - more may remain for next sweep`);
  }
  return { scanned: candidates.length, sent, ...(opts.dryRun ? { preview } : {}) };
}

/**
 * Profile-completion reminders: a PERSISTENT sequence that keeps nudging members
 * who signed up but never finished their profile (no profile row, or a profile
 * with no photo - the photo is the join gate). A reminder goes out at each stage
 * below until they complete, one email per stage, then we stop.
 *
 * Separate audience from the re-engagement sequence above (which only targets
 * fully set-up, then-inactive members). Idempotency markers in DomainEvent make
 * it safe to run every few hours and across instances.
 */
const COMPLETE_STAGE_DAYS = [1, 3, 7, 14, 30] as const;
const COMPLETE_STOP_AFTER_DAYS = 45;

/** The highest completion stage a member `daysOld` days old should have received. */
function completionStageFor(daysOld: number): number | null {
  if (daysOld >= COMPLETE_STOP_AFTER_DAYS) return null;
  for (let i = COMPLETE_STAGE_DAYS.length - 1; i >= 0; i--) {
    if (daysOld >= COMPLETE_STAGE_DAYS[i]!) return COMPLETE_STAGE_DAYS[i]!;
  }
  return null;
}

/** Per-stage marker. Stage 1 keeps the legacy id so anyone who already got the
 *  original single reminder isn't re-sent stage 1. */
function completionMarkerId(userId: string, stage: number): string {
  return stage === 1 ? `complete_profile:${userId}` : `complete_profile:${userId}:d${stage}`;
}

export async function runProfileCompletionReminders(
  opts: { dryRun?: boolean } = {},
): Promise<{ scanned: number; sent: number; preview?: { email: string; stage: number; daysOld: number }[] }> {
  const now = Date.now();
  const dayAgo = new Date(now - 1 * DAY); // first reminder at ~24h
  const oldestToNudge = new Date(now - COMPLETE_STOP_AFTER_DAYS * DAY);

  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...AUDIENCE_GUARD, // members only - no admins/staff/demo
      createdAt: { lte: dayAgo, gte: oldestToNudge },
      // Incomplete = no profile at all, OR a profile with no photo (join gate).
      OR: [{ memberProfile: { is: null } }, { memberProfile: { photoUrl: null } }],
    },
    select: { id: true, email: true, firstName: true, createdAt: true },
    take: BATCH,
    orderBy: { createdAt: 'asc' },
  });

  const preview: { email: string; stage: number; daysOld: number }[] = [];
  let sent = 0;
  for (const u of candidates) {
    const daysOld = Math.floor((now - u.createdAt.getTime()) / DAY);
    const stage = completionStageFor(daysOld);
    if (!stage) continue;
    const markerId = completionMarkerId(u.id, stage);

    if (opts.dryRun) {
      const already = await prisma.domainEvent.findUnique({
        where: { id: markerId },
        select: { id: true },
      });
      if (!already) preview.push({ email: u.email, stage, daysOld });
      continue;
    }

    // Claim the once-per-stage marker atomically; skip if already sent.
    try {
      await prisma.domainEvent.create({
        data: { id: markerId, type: 'email.complete_profile', aggregateId: u.id, payload: { stage } },
      });
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') continue;
      throw err;
    }

    await sendEmail({
      to: u.email,
      template: 'complete_profile',
      data: { firstName: u.firstName, stage },
    });
    sent += 1;
  }

  return { scanned: candidates.length, sent, ...(opts.dryRun ? { preview } : {}) };
}
