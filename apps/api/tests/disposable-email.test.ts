import { describe, expect, it } from 'vitest';
import { DISPOSABLE_EMAIL_DOMAINS, isDisposableEmail } from '@refnet/shared';

describe('isDisposableEmail', () => {
  it('flags known throwaway providers', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
    expect(isDisposableEmail('test@10minutemail.com')).toBe(true);
    expect(isDisposableEmail('u@yopmail.com')).toBe(true);
  });

  it('allows real email providers', () => {
    expect(isDisposableEmail('sarah@gmail.com')).toBe(false);
    expect(isDisposableEmail('daniel@tworiverscpa.com')).toBe(false);
    expect(isDisposableEmail('founder@company.co')).toBe(false);
  });

  it('is case-insensitive on the domain', () => {
    expect(isDisposableEmail('Test@MAILINATOR.com')).toBe(true);
  });

  it('handles malformed input without throwing', () => {
    expect(isDisposableEmail('no-at-sign')).toBe(false);
    expect(isDisposableEmail('')).toBe(false);
  });

  it('covers at least 20 common providers', () => {
    expect(DISPOSABLE_EMAIL_DOMAINS.size).toBeGreaterThanOrEqual(20);
  });
});
