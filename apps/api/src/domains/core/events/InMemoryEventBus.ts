import type { DomainEventMap } from '@refnet/shared';
import type { EventBus, EventHandler, Unsubscribe } from './EventBus.js';

/**
 * In-process `EventBus` implementation — the Branch 1 default.
 *
 * Behaviour:
 *   - Handlers for a single event type run in parallel (`Promise.all`).
 *   - A thrown handler does not prevent peer handlers from running, and a
 *     handler failure is logged but NOT surfaced to the publisher. Domain
 *     events are side-effects (emails, audit rows, referral linking) fired
 *     after the primary action has already committed, so a failing subscriber
 *     must never roll back or 500 the request that triggered it. Durable
 *     per-handler retry/DLQ semantics arrive with the BullMQ bus in Branch 4.
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

    // Log every handler failure, but never surface it to the publisher — a
    // side-effect subscriber must not break the primary action that already
    // committed (see class docstring).
    for (const r of results) {
      if (r.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error(`[events] handler for "${String(type)}" failed:`, r.reason);
      }
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
