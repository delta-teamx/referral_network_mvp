import { env } from '../../../config/env.js';

/**
 * SMS dispatch with the same provider-abstraction shape as email.service.ts.
 *
 * Two providers:
 *   - TwilioSmsProvider: real SMS when TWILIO_* env vars are all set.
 *   - ConsoleSmsProvider: dev fallback — logs the payload so we can iterate
 *     on copy without burning carrier costs.
 *
 * Phone numbers must be E.164 (+15551234567). Callers should normalize or
 * validate before invoking; we do a sanity check and skip silently for
 * malformed numbers so a bad row doesn't break the whole notification fan-out.
 */

export interface SmsRequest {
  to: string;
  body: string;
}

export interface SmsProvider {
  send(req: SmsRequest): Promise<void>;
}

const E164 = /^\+[1-9]\d{6,14}$/;

export function isValidE164(phone: string | null | undefined): phone is string {
  return typeof phone === 'string' && E164.test(phone);
}

class ConsoleSmsProvider implements SmsProvider {
  async send(req: SmsRequest): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
    // eslint-disable-next-line no-console
    console.log(`[sms] to ${req.to}`);
    // eslint-disable-next-line no-console
    console.log(`[sms] ${req.body}`);
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
  }
}

class TwilioSmsProvider implements SmsProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private from: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any, from: string) {
    this.client = client;
    this.from = from;
  }

  async send(req: SmsRequest): Promise<void> {
    await this.client.messages.create({
      to: req.to,
      from: this.from,
      body: req.body,
    });
  }
}

let providerSingleton: SmsProvider | null = null;
let warned = false;

export function getSmsProvider(): SmsProvider {
  if (providerSingleton) return providerSingleton;

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    try {
      // Lazy require so we don't force the twilio package on dev installs that
      // never send SMS. If the package isn't installed, fall through to console.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      providerSingleton = new TwilioSmsProvider(client, TWILIO_FROM_NUMBER);
      return providerSingleton;
    } catch (err) {
      if (!warned) {
        // eslint-disable-next-line no-console
        console.warn('[sms] TWILIO_* env set but twilio package missing — falling back to console', err);
        warned = true;
      }
    }
  }

  providerSingleton = new ConsoleSmsProvider();
  return providerSingleton;
}

export async function sendSms(req: SmsRequest): Promise<void> {
  if (!isValidE164(req.to)) {
    // eslint-disable-next-line no-console
    console.warn('[sms] skipping non-E.164 number:', req.to);
    return;
  }
  await getSmsProvider().send(req);
}

// Exposed for tests that want to install a stub.
export function _resetSmsProviderForTests(provider?: SmsProvider): void {
  providerSingleton = provider ?? null;
}
