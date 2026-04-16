import type { DomainEventMap } from '@refnet/shared';

export type EventHandler<K extends keyof DomainEventMap> = (
  payload: DomainEventMap[K],
) => void | Promise<void>;

/**
 * Typed pub/sub for domain events. Every consumer (email dispatch, SMS
 * dispatch, analytics aggregation, lead distribution, relationship-
 * strength recompute) subscribes via this interface, which keeps the
 * coupling between domains one-way (publisher never imports subscriber).
 *
 * Branch 1 implementation is in-process (see `InMemoryEventBus`). Branch 4
 * swaps in a BullMQ-backed implementation that also persists to the
 * `DomainEvent` table for audit + replay, without changing this contract.
 */
export interface EventBus {
  publish<K extends keyof DomainEventMap>(type: K, payload: DomainEventMap[K]): Promise<void>;

  subscribe<K extends keyof DomainEventMap>(type: K, handler: EventHandler<K>): Unsubscribe;
}

export type Unsubscribe = () => void;
