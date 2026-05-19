import { env } from '../../../config/env.js';

/**
 * Email dispatch. Two providers are implemented:
 *   - SendGridEmailProvider — lazy-loads @sendgrid/mail when SENDGRID_API_KEY
 *     is set at boot. Ships real HTML emails per template.
 *   - ConsoleEmailProvider — dev fallback that prints the email body to
 *     stdout so developers (and demo deploys) can continue without keys.
 *
 * Template bodies live in `renderTemplate` below — keep them plaintext-first
 * with a simple `html` variant so both providers can render them.
 */

export type EmailTemplate =
  | 'verify_email'
  | 'otp'
  | 'password_reset'
  | 'welcome'
  | 'invitation'
  | 'lead_received'
  | 'referral_received'
  | 'booking_confirmed'
  | 'event_registered';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 or plain
  contentType: string;
}

export interface EmailRequest {
  to: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(req: EmailRequest): Promise<void>;
}

interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function renderTemplate(req: EmailRequest): RenderedEmail {
  const d = req.data;
  const appName = 'NRG';
  switch (req.template) {
    case 'verify_email':
      return {
        subject: `Verify your ${appName} email`,
        text: `Welcome! Click to verify your email: ${d.verifyUrl}`,
        html: basicLayout(
          'Verify your email',
          `<p>Welcome to ${appName}.</p><p>Confirm your email to unlock your account:</p>${cta('Verify email', String(d.verifyUrl))}`,
        ),
      };
    case 'otp':
      return {
        subject: `${d.otpCode} is your ${appName} verification code`,
        text: `Your verification code is: ${d.otpCode}. It expires in 10 minutes.`,
        html: basicLayout(
          'Your verification code',
          `<p>Hi ${d.firstName ?? 'there'},</p>
           <p>Enter this code to verify your email:</p>
           <div style="margin:24px 0;text-align:center">
             <span style="display:inline-block;font-size:32px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:16px 32px;border-radius:12px;color:#111">${d.otpCode}</span>
           </div>
           <p style="color:#888;font-size:13px">This code expires in 10 minutes. If you didn’t request this, ignore this email.</p>`,
        ),
      };
    case 'password_reset':
      return {
        subject: `Reset your ${appName} password`,
        text: `Reset link (expires in 1 hour): ${d.resetUrl}`,
        html: basicLayout(
          'Reset your password',
          `<p>Click below to set a new password. The link expires in 1 hour.</p>${cta('Reset password', String(d.resetUrl))}<p style="color:#888;font-size:12px">If you didn\u2019t request this, ignore this email.</p>`,
        ),
      };
    case 'welcome':
      return {
        subject: `Welcome to ${appName}`,
        text: `Your account is live. Start by completing onboarding: ${d.onboardingUrl}`,
        html: basicLayout(
          `Welcome aboard`,
          `<p>Your account is ready. Tell us a little about your goals and we\u2019ll match you to the right pros and partners.</p>${cta('Complete onboarding', String(d.onboardingUrl))}`,
        ),
      };
    case 'invitation':
      return {
        subject: `${d.senderName ?? 'A peer'} invited you to ${appName}`,
        text: `${d.senderName ?? 'A peer'} wants to connect on ${appName}: ${d.inviteUrl}`,
        html: basicLayout(
          `You\u2019ve been invited to ${appName}`,
          `<p><strong>${d.senderName ?? 'A peer'}</strong> invited you to join their referral network.</p>${d.message ? `<blockquote style="border-left:3px solid #2563eb;padding:8px 12px;color:#444;margin:16px 0">${escapeHtml(String(d.message))}</blockquote>` : ''}${cta('Accept invitation', String(d.inviteUrl))}`,
        ),
      };
    case 'lead_received':
      return {
        subject: `New lead: ${d.eventType}`,
        text: `You have a new ${d.eventType} lead on ${appName}. View: ${d.leadUrl}`,
        html: basicLayout(
          'New lead received',
          `<p>A consumer in zip <strong>${d.zip ?? '—'}</strong> is asking for help with <strong>${d.eventType}</strong>.</p>${cta('View lead', String(d.leadUrl))}`,
        ),
      };
    case 'referral_received':
      return {
        subject: `New referral from ${d.senderName ?? 'a peer'}`,
        text: `You received a referral from ${d.senderName ?? 'a peer'}. Client: ${d.clientName}. View: ${d.referralUrl}`,
        html: basicLayout(
          'New B2B referral',
          `<p><strong>${d.senderName ?? 'A peer'}</strong> sent you a client referral.</p><p><strong>Client:</strong> ${d.clientName ?? '—'}<br><strong>Notes:</strong> ${d.notes ?? '—'}</p>${cta('View referral', String(d.referralUrl))}`,
        ),
      };
    case 'booking_confirmed':
      return {
        subject: `Call confirmed: ${d.withName ?? 'your booking'} on ${d.whenLabel ?? ''}`,
        text: `Your call with ${d.withName} is confirmed for ${d.whenLabel}. Join via Zoom: ${d.zoomUrl}`,
        html: basicLayout(
          'Call confirmed',
          `<p>Your call with <strong>${d.withName ?? ''}</strong> is confirmed.</p>
           <p><strong>When:</strong> ${d.whenLabel ?? ''}<br>
           <strong>Reason:</strong> ${d.reason ?? ''}</p>
           ${d.notes ? `<blockquote style="border-left:3px solid #2563eb;padding:8px 12px;color:#444;margin:16px 0">${escapeHtml(String(d.notes))}</blockquote>` : ''}
           ${cta('Join Zoom meeting', String(d.zoomUrl ?? '#'))}
           <p style="color:#888;font-size:12px">A calendar invite is attached — open it to add this to your calendar.</p>`,
        ),
      };
    case 'event_registered':
      return {
        subject: `Registered: ${d.title}`,
        text: `You\u2019re registered for ${d.title} on ${d.whenLabel}. Zoom: ${d.zoomUrl}`,
        html: basicLayout(
          `You\u2019re in`,
          `<p>You\u2019re registered for <strong>${d.title ?? ''}</strong>.</p>
           <p><strong>When:</strong> ${d.whenLabel ?? ''}</p>
           ${cta('Add to calendar & Zoom link', String(d.eventUrl ?? '#'))}`,
        ),
      };
  }
}

function basicLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 16px;">${heading}</h1>
    ${bodyHtml}
    <hr style="border:0;border-top:1px solid #eee;margin:32px 0 16px;">
    <p style="color:#888;font-size:12px;margin:0;">NRG · Trusted local pros, matched to life\u2019s moments</p>
  </body></html>`;
}

function cta(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${escapeAttr(url)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}

class ConsoleEmailProvider implements EmailProvider {
  async send(req: EmailRequest): Promise<void> {
    const r = renderTemplate(req);
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
    // eslint-disable-next-line no-console
    console.log(`[email:${req.template}] to ${req.to} · from ${env.EMAIL_FROM}`);
    // eslint-disable-next-line no-console
    console.log(`[email:${req.template}] subject: ${r.subject}`);
    // eslint-disable-next-line no-console
    console.log(`[email:${req.template}] ${r.text}`);
    // eslint-disable-next-line no-console
    console.log('─'.repeat(70));
  }
}

class SendGridEmailProvider implements EmailProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async send(req: EmailRequest): Promise<void> {
    const r = renderTemplate(req);
    const attachments = (req.attachments ?? []).map((a) => ({
      content: Buffer.from(a.content).toString('base64'),
      filename: a.filename,
      type: a.contentType,
      disposition: 'attachment' as const,
    }));
    await this.client.send({
      to: req.to,
      from: env.EMAIL_FROM,
      subject: r.subject,
      text: r.text,
      html: r.html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    // eslint-disable-next-line no-console
    console.log(`[email:sendgrid] sent "${r.subject}" to ${req.to}`);
  }
}

async function createProvider(): Promise<EmailProvider> {
  if (!env.SENDGRID_API_KEY) return new ConsoleEmailProvider();
  try {
    const mod = await import('@sendgrid/mail');
    const sgMail = mod.default ?? mod;
    sgMail.setApiKey(env.SENDGRID_API_KEY);
    // eslint-disable-next-line no-console
    console.log('[email] SendGrid provider active');
    return new SendGridEmailProvider(sgMail);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[email] SENDGRID_API_KEY set but @sendgrid/mail not installed; falling back to console');
    return new ConsoleEmailProvider();
  }
}

// Lazy-init singleton so startup isn't blocked if SendGrid is slow.
let providerPromise: Promise<EmailProvider> | null = null;
function getProvider(): Promise<EmailProvider> {
  if (!providerPromise) providerPromise = createProvider();
  return providerPromise;
}

/** Queue an email for delivery. Never throws — failures are logged. */
export async function sendEmail(req: EmailRequest): Promise<void> {
  try {
    const p = await getProvider();
    await p.send(req);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err);
  }
}
