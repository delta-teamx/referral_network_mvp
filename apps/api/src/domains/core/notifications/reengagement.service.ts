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
      role: { not: 'ADMIN' },
      email: { not: { endsWith: '@vpn-demo.com' } },
      // Inactive for at least 3 days (never-logged-in falls back to createdAt).
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
