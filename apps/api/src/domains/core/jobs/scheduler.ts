import { env } from '../../../config/env.js';
import { recomputeAllTrustScores } from '../trust/trust.service.js';
import { refreshAllSuggestions } from '../../matching/ai/ai-matching.service.js';

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
];

function isRealRedis(url: string): boolean {
  // Local default we ship in .env.example — treat as "not configured".
  if (!url) return false;
  if (url === 'redis://localhost:6379' || url === 'redis://127.0.0.1:6379') return false;
  return url.startsWith('redis://') || url.startsWith('rediss://');
}

async function tryBullMqStart(): Promise<boolean> {
  if (!isRealRedis(env.REDIS_URL)) return false;

  try {
    // @ts-expect-error — bullmq is an optional runtime dep.
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
    // Run once at boot after a short delay (lets the DB settle), then on
    // the declared interval. Unref so the timer doesn't keep node alive
    // during graceful shutdown.
    const firstRun = setTimeout(() => {
      void job.handler().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[jobs] ${job.name}: first run failed`, err);
      });
    }, 5_000);
    firstRun.unref?.();

    const timer = setInterval(() => {
      void job.handler().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[jobs] ${job.name}: run failed`, err);
      });
    }, job.intervalMs);
    timer.unref?.();

    // eslint-disable-next-line no-console
    console.log(`[jobs] ${job.name}: scheduled via setInterval (every ${job.intervalMs}ms)`);
  }
}

export async function startScheduler(): Promise<void> {
  if (env.NODE_ENV === 'test') return;
  const startedOnBullMq = await tryBullMqStart();
  if (!startedOnBullMq) startIntervalFallback();
}
