import { runDailyMatchmaking } from './pods.service.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the daily matchmaking scheduler. Runs at the top of each hour
 * and triggers pod formation if it's 9 AM UTC. In production, replace
 * with a proper cron job (BullMQ repeatable job or external cron).
 */
export function startMatchmakingScheduler(): void {
  if (intervalId) return;

  // Check every hour
  intervalId = setInterval(async () => {
    const now = new Date();
    if (now.getUTCHours() === 14) { // 9 AM EST = 14 UTC
      try {
        await runDailyMatchmaking();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[matchmaking-scheduler] failed:', err);
      }
    }
  }, 60 * 60 * 1000);

  // eslint-disable-next-line no-console
  console.log('[matchmaking-scheduler] started — runs daily at 9 AM EST (14:00 UTC)');
}
