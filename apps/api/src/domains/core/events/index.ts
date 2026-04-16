import { InMemoryEventBus } from './InMemoryEventBus.js';
import type { EventBus } from './EventBus.js';

export type { EventBus, EventHandler, Unsubscribe } from './EventBus.js';
export { InMemoryEventBus } from './InMemoryEventBus.js';

/**
 * Process-wide singleton. Domains import this when publishing, and
 * register subscribers at bootstrap time (see `src/index.ts`).
 *
 * Branch 4 swaps the concrete instance for a BullMQ-backed bus — no
 * caller changes since they depend on the `EventBus` interface.
 */
export const eventBus: EventBus = new InMemoryEventBus();
