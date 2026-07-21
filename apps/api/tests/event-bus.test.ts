import { describe, expect, it, vi } from 'vitest';
import { InMemoryEventBus } from '../src/domains/core/events/InMemoryEventBus.js';

describe('InMemoryEventBus', () => {
  it('delivers published events to subscribers', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('user.signed_up', handler);

    await bus.publish('user.signed_up', {
      userId: 'u1',
      email: 'u@example.com',
      role: 'CONSUMER',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      userId: 'u1',
      email: 'u@example.com',
      role: 'CONSUMER',
    });
  });

  it('fans out to multiple subscribers of the same event', async () => {
    const bus = new InMemoryEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe('referral.sent', a);
    bus.subscribe('referral.sent', b);

    await bus.publish('referral.sent', {
      referralId: 'r1',
      senderId: 'u1',
      receiverId: 'u2',
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('does not notify handlers registered for other event types', async () => {
    const bus = new InMemoryEventBus();
    const other = vi.fn();
    bus.subscribe('group.created', other);

    await bus.publish('referral.sent', {
      referralId: 'r1',
      senderId: 'u1',
      receiverId: 'u2',
    });

    expect(other).not.toHaveBeenCalled();
  });

  it('runs every subscriber even if one throws, and never surfaces the error', async () => {
    const bus = new InMemoryEventBus();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    bus.subscribe('listing.created', bad);
    bus.subscribe('listing.created', good);

    // A failing side-effect subscriber must NOT reject the publish — the
    // primary action has already committed by the time events fire.
    await expect(
      bus.publish('listing.created', { listingId: 'l1', userId: 'u1' }),
    ).resolves.toBeUndefined();

    // Both handlers still got to run (Promise.allSettled semantics).
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });
});
