import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetSmsProviderForTests,
  isValidE164,
  sendSms,
  type SmsProvider,
} from '../src/domains/core/notifications/sms.service.js';

afterEach(() => {
  _resetSmsProviderForTests();
});

describe('isValidE164', () => {
  it('accepts well-formed E.164 numbers', () => {
    expect(isValidE164('+15551234567')).toBe(true);
    expect(isValidE164('+442071234567')).toBe(true);
  });

  it('rejects malformed numbers', () => {
    expect(isValidE164(null)).toBe(false);
    expect(isValidE164(undefined)).toBe(false);
    expect(isValidE164('5551234567')).toBe(false); // missing +
    expect(isValidE164('+0123456')).toBe(false); // leading zero
    expect(isValidE164('')).toBe(false);
    expect(isValidE164('+1-555-123-4567')).toBe(false); // dashes
  });
});

describe('sendSms', () => {
  it('dispatches to the active provider for valid numbers', async () => {
    const send = vi.fn(async () => undefined);
    _resetSmsProviderForTests({ send } satisfies SmsProvider);

    await sendSms({ to: '+15551234567', body: 'hello' });

    expect(send).toHaveBeenCalledWith({ to: '+15551234567', body: 'hello' });
  });

  it('skips silently for invalid numbers without invoking the provider', async () => {
    const send = vi.fn(async () => undefined);
    _resetSmsProviderForTests({ send } satisfies SmsProvider);

    await sendSms({ to: 'not-a-number', body: 'hello' });
    await sendSms({ to: '', body: 'hello' });

    expect(send).not.toHaveBeenCalled();
  });
});
