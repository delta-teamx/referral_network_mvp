import { env } from '../../../config/env.js';

/**
 * SMS delivery — Twilio when credentials are set, console fallback otherwise.
 * Same pattern as email.service.ts: lazy-load the SDK so the app boots
 * without twilio installed.
 */

export interface SmsRequest {
  to: string;
  body: string;
}

interface SmsProvider {
  send(req: SmsRequest): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(req: SmsRequest): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[sms:console] to ${req.to}: ${req.body}`);
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
    // eslint-disable-next-line no-console
    console.log(`[sms:twilio] sent to ${req.to}`);
  }
}

async function createProvider(): Promise<SmsProvider> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    return new ConsoleSmsProvider();
  }
  try {
    // @ts-expect-error — twilio is an optional runtime dep.
    const twilio = (await import('twilio')).default;
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    // eslint-disable-next-line no-console
    console.log('[sms] Twilio provider active');
    return new TwilioSmsProvider(client, env.TWILIO_PHONE_NUMBER);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[sms] Twilio credentials set but SDK not installed; falling back to console');
    return new ConsoleSmsProvider();
  }
}

let providerPromise: Promise<SmsProvider> | null = null;
function getProvider(): Promise<SmsProvider> {
  if (!providerPromise) providerPromise = createProvider();
  return providerPromise;
}

export async function sendSms(req: SmsRequest): Promise<void> {
  try {
    const p = await getProvider();
    await p.send(req);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[sms] send failed', err);
  }
}

export function formatIntroSms(senderName: string, targetName: string, reason: string): string {
  return `${senderName} wants to connect with you on VirtualProsNetwork: "${reason.slice(0, 100)}". Log in to respond.`;
}

export function formatLeadSms(eventType: string): string {
  return `New ${eventType} lead on VirtualProsNetwork. Log in to view details and respond.`;
}

export function formatReferralSms(senderName: string): string {
  return `${senderName} sent you a client referral on VirtualProsNetwork. Log in to accept.`;
}
