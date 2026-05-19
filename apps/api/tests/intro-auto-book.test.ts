import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/domains/network/bookings/bookings.service.js', () => ({
  getAvailableSlots: vi.fn(),
  createBooking: vi.fn(),
}));

vi.mock('../src/domains/core/events/index.js', () => ({
  eventBus: { publish: vi.fn(async () => undefined), subscribe: vi.fn() },
}));

import { autoBookFromIntro } from '../src/domains/matching/ai/intro-auto-book.service.js';
import {
  createBooking,
  getAvailableSlots,
} from '../src/domains/network/bookings/bookings.service.js';
import { eventBus } from '../src/domains/core/events/index.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('autoBookFromIntro', () => {
  it('books the earliest mutual 30-minute slot', async () => {
    vi.mocked(getAvailableSlots)
      .mockResolvedValueOnce([
        { startsAt: '2026-05-20T15:00:00.000Z', endsAt: '2026-05-20T15:30:00.000Z' },
        { startsAt: '2026-05-21T17:00:00.000Z', endsAt: '2026-05-21T17:30:00.000Z' },
      ])
      .mockResolvedValueOnce([
        { startsAt: '2026-05-19T20:00:00.000Z', endsAt: '2026-05-19T20:30:00.000Z' },
        { startsAt: '2026-05-21T17:00:00.000Z', endsAt: '2026-05-21T17:30:00.000Z' },
      ]);
    vi.mocked(createBooking).mockResolvedValue({
      id: 'book_123',
      startsAt: new Date('2026-05-21T17:00:00.000Z'),
    } as never);

    const result = await autoBookFromIntro({
      introId: 'intro_1',
      hostUserId: 'user_a',
      guestUserId: 'user_b',
    });

    expect(result.booked).toBe(true);
    expect(result.bookingId).toBe('book_123');
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUserId: 'user_a',
        guestUserId: 'user_b',
        startsAt: new Date('2026-05-21T17:00:00.000Z'),
        endsAt: new Date('2026-05-21T17:30:00.000Z'),
        reason: 'general_intro',
      }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('emits intro.auto_booking_skipped when schedules do not overlap', async () => {
    vi.mocked(getAvailableSlots)
      .mockResolvedValueOnce([
        { startsAt: '2026-05-20T15:00:00.000Z', endsAt: '2026-05-20T15:30:00.000Z' },
      ])
      .mockResolvedValueOnce([
        { startsAt: '2026-05-21T17:00:00.000Z', endsAt: '2026-05-21T17:30:00.000Z' },
      ]);

    const result = await autoBookFromIntro({
      introId: 'intro_1',
      hostUserId: 'user_a',
      guestUserId: 'user_b',
    });

    expect(result.booked).toBe(false);
    expect(result.reason).toBe('no_overlap');
    expect(createBooking).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      'intro.auto_booking_skipped',
      expect.objectContaining({ reason: 'no_overlap' }),
    );
  });

  it('skips when either side has no availability', async () => {
    vi.mocked(getAvailableSlots).mockResolvedValueOnce([]).mockResolvedValueOnce([
      { startsAt: '2026-05-21T17:00:00.000Z', endsAt: '2026-05-21T17:30:00.000Z' },
    ]);

    const result = await autoBookFromIntro({
      introId: 'intro_1',
      hostUserId: 'user_a',
      guestUserId: 'user_b',
    });

    expect(result.booked).toBe(false);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('falls back gracefully if createBooking throws', async () => {
    vi.mocked(getAvailableSlots).mockResolvedValue([
      { startsAt: '2026-05-21T17:00:00.000Z', endsAt: '2026-05-21T17:30:00.000Z' },
    ]);
    vi.mocked(createBooking).mockRejectedValue(new Error('zoom api down'));

    const result = await autoBookFromIntro({
      introId: 'intro_1',
      hostUserId: 'user_a',
      guestUserId: 'user_b',
    });

    expect(result.booked).toBe(false);
    expect(result.reason).toBe('error');
    expect(eventBus.publish).toHaveBeenCalledWith(
      'intro.auto_booking_skipped',
      expect.objectContaining({ reason: 'error' }),
    );
  });
});
