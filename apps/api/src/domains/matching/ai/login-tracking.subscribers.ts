import type { eventBus as EventBus } from '../../core/events/index.js';
import { prisma } from '../../../config/prisma.js';

/**
 * Records a LoginEvent row every time `user.logged_in` fires. The streak
 * counter and the engagement service consume these rows to compute real
 * consecutive-week activity. Cap on retention is handled separately —
 * the table is index-only on (userId, occurredAt) so growth is cheap.
 */
export function registerLoginTrackingSubscribers(bus: typeof EventBus): void {
  bus.subscribe('user.logged_in', async ({ userId }) => {
    try {
      await prisma.loginEvent.create({ data: { userId } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[login-tracking] insert failed for', userId, err);
    }
  });
}
