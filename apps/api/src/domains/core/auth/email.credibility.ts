import { promises as dns } from 'node:dns';
import { isDisposableEmail } from '@refnet/shared';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Email credibility gates for signup.
 *
 *   1. Disposable / throwaway domains are rejected outright (fast, static list).
 *   2. MX record lookup — rejects domains with no mail exchanger at all.
 *      Gated by env `EMAIL_MX_CHECK` because it adds a DNS roundtrip and may
 *      false-positive during local dev.
 *
 * Both checks are cheap. Deeper reputation scoring (Kickbox, EmailRep) is
 * out of scope for Branch 4 — those need paid API keys.
 */

const mxCache = new Map<string, { ok: boolean; expiresAt: number }>();
const MX_CACHE_TTL_MS = 30 * 60 * 1000;

export async function assertEmailIsCredible(email: string): Promise<void> {
  if (isDisposableEmail(email)) {
    throw AppError.badRequest(
      'Please use a non-disposable email address. Work email works best.',
      'auth/disposable_email',
    );
  }

  // Allow bypass for test runs and local dev.
  if (env.NODE_ENV !== 'production' && process.env.EMAIL_MX_CHECK !== '1') return;

  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase().trim();
  if (!domain || !domain.includes('.')) {
    throw AppError.badRequest('Email domain looks invalid.', 'auth/invalid_domain');
  }

  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.ok) {
      throw AppError.badRequest(
        'We could not verify that domain can receive email.',
        'auth/no_mx_record',
      );
    }
    return;
  }

  let hasMx = false;
  try {
    const records = await dns.resolveMx(domain);
    hasMx = records.length > 0;
  } catch {
    // Fall back to A/AAAA lookup — some domains accept mail without MX.
    try {
      await dns.resolve4(domain);
      hasMx = true;
    } catch {
      hasMx = false;
    }
  }

  mxCache.set(domain, { ok: hasMx, expiresAt: Date.now() + MX_CACHE_TTL_MS });

  if (!hasMx) {
    throw AppError.badRequest(
      'We could not verify that domain can receive email.',
      'auth/no_mx_record',
    );
  }
}
