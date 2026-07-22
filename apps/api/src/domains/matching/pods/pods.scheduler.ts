import { runDailyMatchmaking } from './pods.service.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the WEEKLY matchmaking scheduler. Checks hourly and forms the week's
 * networking boards every Monday at 14:00 UTC. On a host that sleeps when idle
 * (e.g. Render free tier) this may not fire on time — admins can always form
 * the board on demand via POST /api/v1/pods/trigger. In production, replace
 * with a proper cron (BullMQ repeatable job or external scheduler).
 */
export function startMatchmakingScheduler(): void {
  if (intervalId) return;

  // Check every hour; run once a week on Monday at 14:00 UTC (9 AM EST).
  intervalId = setInterval(async () => {
    const now = new Date();
    if (now.getUTCDay() === 1 && now.getUTCHours() === 14) {
      try {
        await runDailyMatchmaking();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[matchmaking-scheduler] failed:', err);
      }
    }
  }, 60 * 60 * 1000);

  // eslint-disable-next-line no-console
  console.log('[matchmaking-scheduler] started — runs weekly on Monday 14:00 UTC');
}
