import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { recomputeAllTrustScores } from '../trust/trust.service.js';
import { runBookingReminders } from '../../network/bookings/bookings.service.js';
import { refreshAllSuggestions } from '../../matching/ai/ai-matching.service.js';
import { retrainFromOutcomes } from '../../matching/ai/ai-learning.service.js';
import {
  runReengagementSweep,
  runProfileCompletionReminders,
} from '../notifications/reengagement.service.js';
import { runNotificationDigests } from '../notifications/digest.service.js';
import { runWeeklyDigests } from '../notifications/weekly-digest.service.js';
import { runSupportEscalationSweep } from '../support/support.service.js';

/**
 * Background scheduler for long-running / periodic work.
 *
 *   - BullMQ mode: when REDIS_URL points at a real Redis (not the default
 *     localhost placeholder we ship in .env for dev), we create a repeatable
 *     BullMQ job for each scheduled task. BullMQ guarantees single-run
 *     semantics across multiple API instances and persists schedules.
 *
 *   - Interval mode: when Redis isn't configured or the SDK isn't installed,
 *     we run the same jobs via `setInterval` in the API process. Good enough
 *     for a single-instance deploy; duplicates run with N instances.
 *
 * Jobs currently registered:
 *   - recompute-trust-scores: every 24 hours
 *
 * Adding a job: push a `JobDefinition` into JOBS and it's picked up on boot.
 */

interface JobDefinition {
  name: string;
  intervalMs: number;
  handler: () => Promise<unknown>;
}

const JOBS: JobDefinition[] = [
  {
    name: 'recompute-trust-scores',
    intervalMs: 24 * 60 * 60 * 1000,
    handler: async () => {
      const result = await recomputeAllTrustScores();
      // eslint-disable-next-line no-console
      console.log(
        `[jobs] recompute-trust-scores: updated ${result.updated} listings in ${result.ms}ms`,
      );
      return result;
    },
  },
  {
    name: 'refresh-ai-suggestions',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    handler: async () => {
      const result = await refreshAllSuggestions();
      // eslint-disable-next-line no-console
      console.log(
        `[jobs] refresh-ai-suggestions: ${result.intros} intros for ${result.users} users`,
      );
      return result;
    },
  },
  {
    name: 'retrain-ai-weights',
    intervalMs: 24 * 60 * 60 * 1000, // Daily
    handler: async () => {
      const result = await retrainFromOutcomes();
      // eslint-disable-next-line no-console
      console.log(
        `[jobs] retrain-ai-weights: processed ${result.introsProcessed} intros`,
      );
      return result;
    },
  },
  {
    name: 'reengagement-emails',
    intervalMs: 6 * 60 * 60 * 1000, // Every 6 hours
    handler: async () => {
      const result = await runReengagementSweep();
      // eslint-disable-next-line no-console
      console.log(
        `[jobs] reengagement-emails: scanned ${result.scanned}, sent ${result.sent}`,
      );
      return result;
    },
  },
  {
    name: 'profile-completion-reminders',
    intervalMs: 3 * 60 * 60 * 1000, // Every 3 hours (so the ~24h reminder is timely)
    handler: async () => {
      const result = await runProfileCompletionReminders();
      // eslint-disable-next-line no-console
      console.log(
        `[jobs] profile-completion-reminders: scanned ${result.scanned}, sent ${result.sent}`,
      );
      return result;
    },
  },
  {
    name: 'notification-digests',
    intervalMs: 10 * 60 * 1000, // Every 10 minutes - offline-only message/intro digest
    handler: async () => {
      const result = await runNotificationDigests();
      if (result.sent > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[jobs] notification-digests: scanned ${result.scanned}, sent ${result.sent}`,
        );
      }
      return result;
    },
  },
  {
    name: 'support-escalation-timer',
    intervalMs: 5 * 60 * 1000, // Every 5 min - escalate tickets left waiting 30+ min
    handler: async () => {
      const result = await runSupportEscalationSweep();
      if (result.escalated > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[jobs] support-escalation-timer: scanned ${result.scanned}, escalated ${result.escalated}`,
        );
      }
      return result;
    },
  },
  {
    name: 'weekly-digest',
    intervalMs: 60 * 60 * 1000, // Hourly; self-gates to the Mon 08:00-11:59 ET window
    handler: async () => {
      const result = await runWeeklyDigests();
      if (result.sent > 0) {
        // eslint-disable-next-line no-console
        console.log(`[jobs] weekly-digest: scanned ${result.scanned}, sent ${result.sent}`);
      }
      return result;
    },
  },
  {
    name: 'expire-rewards',
    intervalMs: 30 * 60 * 1000, // Every 30 minutes - expire temporary reward unlocks
    handler: async () => {
      const { expireRewards } = await import('../../network/rewards/rewards.service.js');
      const result = await expireRewards();
      if (result.expired > 0) {
        // eslint-disable-next-line no-console
        console.log(`[jobs] expire-rewards: expired ${result.expired}`);
      }
      return result;
    },
  },
  {
    name: 'booking-reminders',
    intervalMs: 5 * 60 * 1000, // Every 5 min - email a reminder ~30 min before each call
    handler: async () => {
      const result = await runBookingReminders();
      if (result.sent > 0) {
        // eslint-disable-next-line no-console
        console.log(`[jobs] booking-reminders: scanned ${result.scanned}, sent ${result.sent}`);
      }
      return result;
    },
  },
];

/**
 * Distributed lease so the setInterval fallback runs each job on only ONE
 * instance per interval, even without Redis. A single atomic upsert claims the
 * lease when the previous one has expired; losers skip this tick. If the lock
 * table isn't present yet (very first boot before the schema heal), we run
 * anyway - correct for a single instance, and self-corrects on the next tick.
 */
async function tryAcquireJobLease(name: string, leaseMs: number): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `INSERT INTO "SchedulerLock" ("name", "lockedUntil")
       VALUES ($1, now() + ($2 || ' milliseconds')::interval)
       ON CONFLICT ("name") DO UPDATE SET "lockedUntil" = EXCLUDED."lockedUntil"
       WHERE "SchedulerLock"."lockedUntil" < now()
       RETURNING "name"`,
      name,
      String(Math.max(1000, Math.round(leaseMs))),
    );
    return rows.length > 0;
  } catch {
    return true;
  }
}

function isRealRedis(url: string): boolean {
  // Local default we ship in .env.example - treat as "not configured".
  if (!url) return false;
  if (url === 'redis://localhost:6379' || url === 'redis://127.0.0.1:6379') return false;
  return url.startsWith('redis://') || url.startsWith('rediss://');
}

async function tryBullMqStart(): Promise<boolean> {
  if (!isRealRedis(env.REDIS_URL)) return false;

  try {
    // @ts-expect-error - bullmq is an optional runtime dep.
    const bullmq = await import('bullmq');
    const { Queue, Worker } = bullmq;
    const connection = { connection: { url: env.REDIS_URL } };

    for (const job of JOBS) {
      const queue = new Queue(job.name, connection);
      await queue.add(
        job.name,
        {},
        {
          repeat: { every: job.intervalMs },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
      new Worker(
        job.name,
        async () => {
          await job.handler();
        },
        connection,
      );
      // eslint-disable-next-line no-console
      console.log(`[jobs] ${job.name}: scheduled via BullMQ (every ${job.intervalMs}ms)`);
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[jobs] BullMQ unavailable, falling back to in-process intervals:',
      (err as Error).message,
    );
    return false;
  }
}

function startIntervalFallback(): void {
  for (const job of JOBS) {
    // Lease slightly shorter than the interval so it reliably expires before the
    // next tick, letting exactly one instance re-acquire and run each period.
    const leaseMs = Math.max(1000, job.intervalMs - 5_000);
    const runGuarded = async () => {
      if (!(await tryAcquireJobLease(job.name, leaseMs))) return; // another instance owns this tick
      await job.handler();
    };

    // Run once at boot after a short delay (lets the DB settle), then on
    // the declared interval. Unref so the timer doesn't keep node alive
    // during graceful shutdown.
    const firstRun = setTimeout(() => {
      void runGuarded().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[jobs] ${job.name}: first run failed`, err);
      });
    }, 5_000);
    firstRun.unref?.();

    const timer = setInterval(() => {
      void runGuarded().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[jobs] ${job.name}: run failed`, err);
      });
    }, job.intervalMs);
    timer.unref?.();

    // eslint-disable-next-line no-console
    console.log(`[jobs] ${job.name}: scheduled via setInterval (every ${job.intervalMs}ms, DB-leased)`);
  }
}

export async function startScheduler(): Promise<void> {
  if (env.NODE_ENV === 'test') return;
  const startedOnBullMq = await tryBullMqStart();
  if (!startedOnBullMq) startIntervalFallback();
}
