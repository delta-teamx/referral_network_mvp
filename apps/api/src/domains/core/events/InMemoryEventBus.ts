import type { DomainEventMap } from '@refnet/shared';
import type { EventBus, EventHandler, Unsubscribe } from './EventBus.js';

/**
 * In-process `EventBus` implementation — the Branch 1 default.
 *
 * Behaviour:
 *   - Handlers for a single event type run in parallel (`Promise.all`).
 *   - A thrown handler does not prevent peer handlers from running; the
 *     first rejection surfaces back to the publisher. This matches the
 *     semantics of BullMQ per-job isolation we'll get in Branch 4.
 *   - Synchronous handlers are allowed (wrapped via `Promise.resolve`).
 *
 * Not suitable beyond a single process — Branch 4 replaces this with a
 * BullMQ-backed implementation that persists events to the `DomainEvent`
 * table for audit, and distributes handlers across worker processes.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<
    keyof DomainEventMap,
    Set<EventHandler<keyof DomainEventMap>>
  >();

  async publish<K extends keyof DomainEventMap>(
    type: K,
    payload: DomainEventMap[K],
  ): Promise<void> {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;

    const results = await Promise.allSettled(
      Array.from(set).map((handler) =>
        Promise.resolve().then(() => (handler as EventHandler<K>)(payload)),
      ),
    );

    // Surface the first failure after all handlers have had a chance to run.
    const firstRejection = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (firstRejection) {
      // eslint-disable-next-line no-console
      console.error(`[events] handler for "${String(type)}" failed:`, firstRejection.reason);
      throw firstRejection.reason;
    }
  }

  subscribe<K extends keyof DomainEventMap>(type: K, handler: EventHandler<K>): Unsubscribe {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<keyof DomainEventMap>);
    return () => {
      set!.delete(handler as EventHandler<keyof DomainEventMap>);
    };
  }
}
