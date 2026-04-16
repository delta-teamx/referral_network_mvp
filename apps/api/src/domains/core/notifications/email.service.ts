import { env } from '../../../config/env.js';

/**
 * Email dispatch — single send function with a template key + data bag.
 *
 * Branch 2 ships the `ConsoleEmailProvider` only: every email is printed
 * to stdout with the verification/reset URL so developers can click
 * through without needing SendGrid credentials. Swap in a real provider
 * (SendGrid / SES) by flipping the factory below once keys are set.
 */

export type EmailTemplate =
  | 'verify_email'
  | 'password_reset'
  | 'welcome'
  | 'invitation'
  | 'lead_received'
  | 'referral_received';

export interface EmailRequest {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

export interface EmailProvider {
  send(req: EmailRequest): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(req: EmailRequest): Promise<void> {
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
    // eslint-disable-next-line no-console
    console.log(`[email:${req.template}] to ${req.to}`);
    // eslint-disable-next-line no-console
    console.log(`[email:${req.template}] from ${env.EMAIL_FROM}`);
    for (const [k, v] of Object.entries(req.data)) {
      // eslint-disable-next-line no-console
      console.log(`[email:${req.template}] ${k}: ${String(v)}`);
    }
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
  }
}

function createProvider(): EmailProvider {
  if (env.SENDGRID_API_KEY) {
    // TODO (Branch 3+): drop in a SendGridEmailProvider here once key set.
    // eslint-disable-next-line no-console
    console.warn(
      '[email] SENDGRID_API_KEY set but SendGrid provider not yet implemented; falling back to console',
    );
  }
  return new ConsoleEmailProvider();
}

const provider = createProvider();

/** Queue an email for delivery. Never throws — failures are logged. */
export async function sendEmail(req: EmailRequest): Promise<void> {
  try {
    await provider.send(req);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err);
  }
}
