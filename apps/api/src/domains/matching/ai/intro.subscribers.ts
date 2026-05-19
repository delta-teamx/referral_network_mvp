import type { eventBus as EventBus } from '../../core/events/index.js';
import { autoBookFromIntro } from './intro-auto-book.service.js';

/**
 * Wires intro lifecycle events into downstream effects. Today this is just
 * the auto-booking bridge on accept; future hooks (analytics, retention
 * nudges) belong here too.
 */
export function registerIntroSubscribers(bus: typeof EventBus): void {
  bus.subscribe('intro.accepted', async (payload) => {
    await autoBookFromIntro({
      introId: payload.introId,
      hostUserId: payload.senderId,
      guestUserId: payload.targetId,
    });
  });
}
