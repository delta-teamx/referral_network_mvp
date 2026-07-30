import { env } from '../../../config/env.js';

/**
 * Email dispatch. Two providers are implemented:
 *   - SendGridEmailProvider - lazy-loads @sendgrid/mail when SENDGRID_API_KEY
 *     is set at boot. Ships real HTML emails per template.
 *   - ConsoleEmailProvider - dev fallback that prints the email body to
 *     stdout so developers (and demo deploys) can continue without keys.
 *
 * Template bodies live in `renderTemplate` below - keep them plaintext-first
 * with a simple `html` variant so both providers can render them.
 */

export type EmailTemplate =
  | 'verify_email'
  | 'otp'
  | 'password_reset'
  | 'welcome'
  | 'new_signup_admin'
  | 'invitation'
  | 'contract_sent'
  | 'contract_signed'
  | 'lead_received'
  | 'referral_received'
  | 'booking_confirmed'
  | 'event_registered'
  | 'support_escalation'
  | 'reengagement';

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
  const appName = 'Referral Nova';
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
    case 'welcome': {
      const firstName = String(d.firstName ?? 'there');
      const dashUrl = `${BRAND.app}/dashboard`;
      const gettingStarted = linkList([
        { label: 'How It Works', url: `${BRAND.marketing}/how-it-works`, desc: 'The 4-step referral engine, start to finish.' },
        { label: 'For Members', url: `${BRAND.marketing}/for-members`, desc: 'What you get and how to make the most of it.' },
        { label: 'Complete your profile', url: `${BRAND.app}/onboarding`, desc: 'Add your business, industry and what you can refer.' },
        { label: 'Record your 60-second intro video', url: `${BRAND.app}/onboarding`, desc: 'Members send far more referrals to people they can see and hear.' },
        { label: 'AI matching & Trust Score', url: `${BRAND.marketing}/trust-score`, desc: 'How we match you and how your Trust Score is calculated.' },
      ]);
      return {
        subject: `Welcome to ${appName} \u2014 here's how to get started`,
        text:
          `Hi ${firstName}, welcome to Referral Nova.\n\n` +
          `Referral Nova turns your network into revenue: our AI matches you with trusted partners and qualified referrals flow both ways, week after week.\n\n` +
          `What happens next: complete your profile, record a 60-second intro, and our AI starts suggesting introductions. First, open your dashboard: ${dashUrl}\n\n` +
          `Getting started: How It Works ${BRAND.marketing}/how-it-works \u00b7 For Members ${BRAND.marketing}/for-members \u00b7 Profile setup ${BRAND.app}/onboarding \u00b7 Trust Score ${BRAND.marketing}/trust-score\n\n` +
          `Privacy ${BRAND.marketing}/privacy \u00b7 Terms ${BRAND.marketing}/terms\n\n` +
          `Thank you for joining \u2014 Founder, Referral Nova`,
        html: brandedLayout(
          `Welcome to Referral Nova, ${escapeHtml(firstName)} \ud83d\udc4b`,
          `<p>We're thrilled to have you. <strong>Referral Nova</strong> turns your professional network into a reliable source of business: our AI matches you with trusted partners, and qualified referrals flow in both directions \u2014 continuously, not just once.</p>
           <p><strong>What happens next:</strong> finish your profile so the AI understands who you are and who you want to meet, record a quick 60-second intro video, and we'll start suggesting introductions and meetings. The best first step is simply to open your dashboard and complete setup.</p>
           ${button('Go to my dashboard', dashUrl)}
           <h2 style="font-size:16px;margin:28px 0 6px;color:${BRAND.ink};">Getting started</h2>
           <p style="margin:0 0 6px;color:${BRAND.gray};font-size:14px;">A few short reads to help you set up and get matched:</p>
           ${gettingStarted}
           <h2 style="font-size:16px;margin:28px 0 10px;color:${BRAND.ink};">The legal bits</h2>
           ${secondaryButtons([
             { label: 'Privacy Policy', url: `${BRAND.marketing}/privacy` },
             { label: 'Terms of Service', url: `${BRAND.marketing}/terms` },
             { label: 'Disclaimers', url: `${BRAND.marketing}/terms#referral-agreements` },
           ])}
           <div style="margin-top:28px;padding-top:20px;border-top:1px solid ${BRAND.line};">
             <p style="margin:0 0 4px;">Thank you for trusting us to help grow your business. We built Referral Nova to make referrals happen on purpose, not by luck \u2014 and we're glad you're here.</p>
             <p style="margin:12px 0 0;color:${BRAND.gray};">Warmly,<br>
             <!-- FOUNDER_NAME_PLACEHOLDER: drop the founder's name on the line below when ready -->
             <strong style="color:${BRAND.ink};">Founder, Referral Nova</strong></p>
           </div>`,
        ),
      };
    }
    case 'new_signup_admin':
      return {
        subject: `New ${appName} sign-up: ${d.name}`,
        text: `New sign-up on ${appName}: ${d.name} (${d.email}) as ${d.role}. Admin: ${d.dashboardUrl}`,
        html: basicLayout(
          'New member sign-up',
          `<p>A new member just joined <strong>${appName}</strong>:</p>
           <p><strong>Name:</strong> ${escapeHtml(String(d.name ?? ''))}<br>
           <strong>Email:</strong> ${escapeHtml(String(d.email ?? ''))}<br>
           <strong>Type:</strong> ${escapeHtml(String(d.role ?? ''))}</p>
           ${cta('Open admin console', String(d.dashboardUrl ?? '#'))}`,
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
    case 'contract_sent':
      return {
        subject: `Contract to review & sign: ${d.title}`,
        text: `${d.senderName} sent you a contract ("${d.title}") on ${appName}. Review and sign it in your Referrals & Invitations tab: ${d.contractUrl}`,
        html: basicLayout(
          'A contract is waiting for your signature',
          `<p><strong>${escapeHtml(String(d.senderName ?? ''))}</strong> sent you a contract on ${appName}:</p>
           <p><strong>${escapeHtml(String(d.title ?? ''))}</strong></p>
           <p>Review the terms and sign it to move the collaboration forward.</p>
           ${cta('Review & sign', String(d.contractUrl ?? '#'))}`,
        ),
      };
    case 'contract_signed':
      return {
        subject: `Contract signed ✅ ${d.title}`,
        text: `The contract "${d.title}" between ${d.senderName} and ${d.receiverName} has been signed by both parties on ${appName}.`,
        html: basicLayout(
          'Contract fully signed',
          `<p>The contract <strong>${escapeHtml(String(d.title ?? ''))}</strong> between
           <strong>${escapeHtml(String(d.senderName ?? ''))}</strong> and
           <strong>${escapeHtml(String(d.receiverName ?? ''))}</strong> is now signed by both parties.</p>
           ${cta('View contract', String(d.contractUrl ?? '#'))}`,
        ),
      };
    case 'lead_received':
      return {
        subject: `New lead: ${d.eventType}`,
        text: `You have a new ${d.eventType} lead on ${appName}. View: ${d.leadUrl}`,
        html: basicLayout(
          'New lead received',
          `<p>A consumer in zip <strong>${d.zip ?? '-'}</strong> is asking for help with <strong>${d.eventType}</strong>.</p>${cta('View lead', String(d.leadUrl))}`,
        ),
      };
    case 'referral_received':
      return {
        subject: `New referral from ${d.senderName ?? 'a peer'}`,
        text: `You received a referral from ${d.senderName ?? 'a peer'}. Client: ${d.clientName}. View: ${d.referralUrl}`,
        html: basicLayout(
          'New B2B referral',
          `<p><strong>${d.senderName ?? 'A peer'}</strong> sent you a client referral.</p><p><strong>Client:</strong> ${d.clientName ?? '-'}<br><strong>Notes:</strong> ${d.notes ?? '-'}</p>${cta('View referral', String(d.referralUrl))}`,
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
           <p style="color:#888;font-size:12px">A calendar invite is attached - open it to add this to your calendar.</p>`,
        ),
      };
    case 'reengagement': {
      const firstName = String(d.firstName ?? 'there');
      const stage = Number(d.stage ?? 3);
      const dashUrl = `${BRAND.app}/dashboard`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      // Follow-up for members who set up their profile and then went quiet.
      // They are already onboarded - the goal is to bring them BACK, not to
      // ask them to finish setup. Escalating warmth: day 3 -> 7 -> 14.
      const copy: Record<
        number,
        { subject: string; heading: string; bodyText: string; bodyHtml: string; cta: string }
      > = {
        3: {
          subject: 'Your Referral Nova network has been busy without you',
          heading: `We've missed you, ${escapeHtml(firstName)}`,
          cta: 'Return to your dashboard',
          bodyText:
            `Hi ${firstName},\n\n` +
            `A few days ago you set up your profile on Referral Nova, and we wanted to reach out personally. Getting your profile live is the hard part, and you're already past it - but the real value starts when you come back and engage with the network you've joined.\n\n` +
            `Since you signed up, our AI matching engine has been quietly working in the background, looking for business owners whose needs line up with what you do and who you want to meet. Referral Nova was built to turn your network into a steady source of warm, qualified referrals - flowing in both directions, week after week - rather than something you have to chase.\n\n` +
            `Right now, all of that is waiting for you inside your dashboard: the members you should meet, the introductions you can request, and the businesses ready to send work your way. It only takes a few minutes to log back in, review your suggested matches, and start a conversation or two.\n\n` +
            `Your seat is still here, and so is everything you set up. Come see who's waiting to meet you.`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`A few days ago you set up your profile on Referral Nova, and we wanted to reach out personally. Getting your profile live is the hard part, and you're already past it &mdash; but the real value starts when you come back and engage with the network you've joined.`) +
            P(`Since you signed up, our AI matching engine has been quietly working in the background, looking for business owners whose needs line up with what you do and who you want to meet. Referral Nova was built to turn your network into a steady source of warm, qualified referrals &mdash; flowing in both directions, week after week &mdash; rather than something you have to chase.`) +
            P(`Right now, all of that is waiting for you inside your dashboard: the members you should meet, the introductions you can request, and the businesses ready to send work your way. It only takes a few minutes to log back in, review your suggested matches, and start a conversation or two.`) +
            P(`Your seat is still here, and so is everything you set up. Come see who's waiting to meet you.`),
        },
        7: {
          subject: "Introductions are waiting for you on Referral Nova",
          heading: `Here's what's happening in your network, ${escapeHtml(firstName)}`,
          cta: 'See my matches',
          bodyText:
            `Hi ${firstName},\n\n` +
            `It's been about a week since you last visited Referral Nova, and we wanted to follow up because you're genuinely missing out on the reason you joined.\n\n` +
            `Referrals are the highest-converting business you can get - a warm introduction from a trusted peer closes far more often than any cold lead or ad. That's exactly what Referral Nova is designed to generate for you on a recurring basis: our AI identifies the right partners, suggests introductions with a clear reason for the match, and gives you the tools to meet over Zoom, track referrals, and even sign simple referral agreements on-platform.\n\n` +
            `While you've been away, the network has kept moving. Members are being matched, introductions are being made, and referrals are being exchanged. Every week you're not active is a week those introductions are going to someone else. As a reminder, founding members hold lifetime Premium at no cost while spots last - a benefit that only pays off if you're in the network using it.\n\n` +
            `Take five minutes to log back in, review the matches our AI has lined up for you, and send your first introduction request. We think you'll be glad you did.`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`It's been about a week since you last visited Referral Nova, and we wanted to follow up because you're genuinely missing out on the reason you joined.`) +
            P(`Referrals are the highest-converting business you can get &mdash; a warm introduction from a trusted peer closes far more often than any cold lead or ad. That's exactly what Referral Nova is designed to generate for you on a recurring basis: our AI identifies the right partners, suggests introductions with a clear reason for the match, and gives you the tools to meet over Zoom, track referrals, and even sign simple referral agreements on-platform.`) +
            P(`While you've been away, the network has kept moving. Members are being matched, introductions are being made, and referrals are being exchanged. Every week you're not active is a week those introductions are going to someone else. As a reminder, founding members hold lifetime Premium at no cost while spots last &mdash; a benefit that only pays off if you're in the network using it.`) +
            P(`Take five minutes to log back in, review the matches our AI has lined up for you, and send your first introduction request. We think you'll be glad you did.`),
        },
        14: {
          subject: 'A final check-in from the Referral Nova team',
          heading: `Still growing through referrals, ${escapeHtml(firstName)}?`,
          cta: 'Come back to Referral Nova',
          bodyText:
            `Hi ${firstName},\n\n` +
            `We noticed it's been two weeks since you set up your profile and stepped away, so this will be our last nudge for now - we don't want to fill your inbox.\n\n` +
            `Before you go, we wanted to be clear about what's still here for you. Your profile, your matches, and (if you're one of our founding members) your lifetime Premium benefits are all intact and waiting. Nothing has been lost. Referral Nova exists to make referrals happen on purpose instead of by luck, and that only works when you're an active part of the network - meeting the partners our AI surfaces for you and exchanging introductions with people who can genuinely move your business forward.\n\n` +
            `If now simply isn't the right time, we completely understand, and your account will be here whenever you're ready to pick it back up. But if you've been meaning to give it a proper look, this is the moment: log in, spend ten minutes reviewing your matches, and start one conversation. That single step is usually what turns a quiet account into real referrals.\n\n` +
            `Thank you for giving Referral Nova a try. We'd love to see you back.\n\n` +
            `- The Referral Nova Team`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`We noticed it's been two weeks since you set up your profile and stepped away, so this will be our last nudge for now &mdash; we don't want to fill your inbox.`) +
            P(`Before you go, we wanted to be clear about what's still here for you. Your profile, your matches, and (if you're one of our founding members) your lifetime Premium benefits are all intact and waiting. Nothing has been lost. Referral Nova exists to make referrals happen on purpose instead of by luck, and that only works when you're an active part of the network &mdash; meeting the partners our AI surfaces for you and exchanging introductions with people who can genuinely move your business forward.`) +
            P(`If now simply isn't the right time, we completely understand, and your account will be here whenever you're ready to pick it back up. But if you've been meaning to give it a proper look, this is the moment: log in, spend ten minutes reviewing your matches, and start one conversation. That single step is usually what turns a quiet account into real referrals.`) +
            P(`Thank you for giving Referral Nova a try. We'd love to see you back.`) +
            `<p style="margin:0 0 4px;color:${BRAND.gray};">&mdash; The Referral Nova Team</p>`,
        },
      };
      const c = copy[stage] ?? copy[3]!;
      const footNote =
        stage === 14
          ? `<p style="margin-top:18px;font-size:12px;color:${BRAND.gray};">Prefer not to receive these check-ins? Just reply to this email and let us know.</p>`
          : '';
      return {
        subject: c.subject,
        text: `${c.bodyText}\n\n${c.cta}: ${dashUrl}`,
        html: brandedLayout(c.heading, `${c.bodyHtml}${button(c.cta, dashUrl)}${footNote}`),
      };
    }
    case 'support_escalation':
      return {
        subject: `⚠️ ROUL escalation: ${d.name ?? 'a user'} stuck on onboarding`,
        text: `ROUL escalated an unresolved onboarding query.\nUser: ${d.name} (${d.email}) · Plan: ${d.plan}\nStuck on: ${d.stuckStep}\nTime: ${d.when}\n\nTranscript:\n${d.transcript}\n\nAdmin: ${d.ticketUrl}`,
        html: brandedLayout(
          'Support escalation from ROUL',
          `<p>ROUL couldn't resolve an onboarding query and escalated it to the technical team.</p>
           <p><strong>User:</strong> ${escapeHtml(String(d.name ?? ''))} (${escapeHtml(String(d.email ?? ''))})<br>
           <strong>Plan:</strong> ${escapeHtml(String(d.plan ?? ''))}<br>
           <strong>Stuck on:</strong> ${escapeHtml(String(d.stuckStep ?? ''))}<br>
           <strong>Time:</strong> ${escapeHtml(String(d.when ?? ''))}</p>
           <p style="font-weight:700;margin-bottom:4px;">Conversation transcript</p>
           <pre style="white-space:pre-wrap;background:#f3f4f6;border-radius:8px;padding:12px;font-size:13px;color:#374151;">${escapeHtml(String(d.transcript ?? ''))}</pre>
           ${button('Open in admin support', String(d.ticketUrl ?? '#'))}`,
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

const BRAND = {
  blue: '#2563eb',
  ink: '#111827',
  gray: '#6b7280',
  line: '#e5e7eb',
  bg: '#f3f4f6',
  marketing: 'https://referralnova.com',
  app: 'https://dashboard.referralnova.com',
};

/** Branded, mobile-safe, table-based layout shared by every email. */
function brandedLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:${BRAND.blue};border-radius:14px 14px 0 0;padding:22px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#ffffff;color:${BRAND.blue};border-radius:9px;font-weight:800;font-size:15px;">RN</span></td>
          <td style="vertical-align:middle;padding-left:12px;"><span style="color:#ffffff;font-weight:800;font-size:18px;">Referral Nova</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;padding:32px 28px;">
        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND.ink};">${heading}</h1>
        <div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid ${BRAND.line};padding:20px 28px 28px;">${legalFooter()}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Back-compat shim: existing templates call basicLayout; route to branded. */
function basicLayout(heading: string, bodyHtml: string): string {
  return brandedLayout(heading, `${bodyHtml}`);
}

function legacyUnusedLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 16px;">${heading}</h1>
    ${bodyHtml}
    <hr style="border:0;border-top:1px solid #eee;margin:32px 0 16px;">
    <p style="color:#888;font-size:12px;margin:0;">Referral Nova · Trusted local pros, matched to life\u2019s moments</p>
  </body></html>`;
}

/** Primary branded button. */
function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:${BRAND.blue};">
    <a href="${escapeAttr(url)}" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:8px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

/** Backwards-compatible alias so existing templates keep working. */
function cta(label: string, url: string): string {
  return button(label, url);
}

/** Row of small secondary (outline) buttons, e.g. legal links. */
function secondaryButtons(items: { label: string; url: string }[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr>${items
    .map(
      (i) =>
        `<td style="padding-right:8px;"><a href="${escapeAttr(i.url)}" style="display:inline-block;padding:8px 14px;border:1px solid ${BRAND.line};border-radius:8px;color:${BRAND.blue};text-decoration:none;font-weight:600;font-size:13px;">${escapeHtml(i.label)}</a></td>`,
    )
    .join('')}</tr></table>`;
}

/** Labeled link list (label + one-line description), for getting-started items. */
function linkList(items: { label: string; url: string; desc: string }[]): string {
  return items
    .map(
      (i) =>
        `<div style="padding:12px 0;border-bottom:1px solid ${BRAND.line};">
           <a href="${escapeAttr(i.url)}" style="color:${BRAND.blue};font-weight:700;text-decoration:none;font-size:15px;">${escapeHtml(i.label)} &rarr;</a>
           <div style="color:${BRAND.gray};font-size:13px;margin-top:2px;">${escapeHtml(i.desc)}</div>
         </div>`,
    )
    .join('');
}

function legalFooter(): string {
  const links = [
    { label: 'Privacy Policy', url: `${BRAND.marketing}/privacy` },
    { label: 'Terms of Service', url: `${BRAND.marketing}/terms` },
    { label: 'Contact', url: `${BRAND.marketing}/contact` },
  ];
  return `<p style="margin:0 0 8px;font-size:12px;color:${BRAND.gray};">
      ${links.map((l) => `<a href="${escapeAttr(l.url)}" style="color:${BRAND.gray};text-decoration:underline;">${l.label}</a>`).join(' &nbsp;&middot;&nbsp; ')}
    </p>
    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
      Referral Nova &mdash; the AI-powered referral network for businesses.<br>
      You're receiving this because you have a Referral Nova account.
    </p>`;
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

/**
 * Resend provider (https://resend.com). Uses the plain REST API via fetch so
 * no extra dependency is needed. Requires RESEND_API_KEY and a verified sender
 * domain matching EMAIL_FROM (for testing you can send from onboarding@resend.dev
 * to your own account email without domain verification).
 */
class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(req: EmailRequest): Promise<void> {
    const r = renderTemplate(req);
    const body: Record<string, unknown> = {
      from: env.EMAIL_FROM,
      to: [req.to],
      subject: r.subject,
      text: r.text,
      html: r.html,
    };
    if (req.attachments && req.attachments.length > 0) {
      body.attachments = req.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString('base64'),
      }));
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend send failed: ${res.status} ${detail}`);
    }
    // eslint-disable-next-line no-console
    console.log(`[email:resend] sent "${r.subject}" to ${req.to}`);
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
  if (env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log('[email] Resend provider active');
    return new ResendEmailProvider(env.RESEND_API_KEY);
  }
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

/** Queue an email for delivery. Never throws - failures are logged. */
export async function sendEmail(req: EmailRequest): Promise<void> {
  try {
    const p = await getProvider();
    await p.send(req);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err);
  }
}

/**
 * Send ONE of every template to a single address with realistic sample data,
 * so the branded redesign can be reviewed across every email in one shot.
 * Returns which templates were dispatched. Admin-only (see admin.routes).
 */
export async function sendTemplatePreviews(to: string): Promise<EmailTemplate[]> {
  const app = 'https://dashboard.referralnova.com';
  const site = 'https://referralnova.com';
  const samples: { template: EmailTemplate; data: Record<string, unknown> }[] = [
    { template: 'verify_email', data: { verifyUrl: `${app}/verify-email?token=sample` } },
    { template: 'otp', data: { firstName: 'Alex', otpCode: '204815' } },
    { template: 'password_reset', data: { firstName: 'Alex', resetUrl: `${app}/reset-password?token=sample` } },
    { template: 'welcome', data: { firstName: 'Alex' } },
    { template: 'new_signup_admin', data: { name: 'Jordan Rivera', email: 'jordan@acme.com', role: 'BUSINESS_OWNER', dashboardUrl: `${app}/admin` } },
    { template: 'invitation', data: { senderName: 'Sam Carter', inviteUrl: `${site}/join/sam-8f2a`, message: 'You would be a great fit for our referral network!' } },
    { template: 'contract_sent', data: { senderName: 'Sam Carter', title: 'Mutual Referral Agreement', contractUrl: `${app}/dashboard/referrals` } },
    { template: 'contract_signed', data: { senderName: 'Sam Carter', receiverName: 'Jordan Rivera', title: 'Mutual Referral Agreement', contractUrl: `${app}/dashboard/referrals` } },
    { template: 'lead_received', data: { eventType: 'Buying a home', zip: '63101', leadUrl: `${app}/dashboard/leads` } },
    { template: 'referral_received', data: { senderName: 'Sam Carter', clientName: 'The Nguyen family', notes: 'Looking for a mortgage broker in St. Louis.', referralUrl: `${app}/dashboard/referrals` } },
    { template: 'booking_confirmed', data: { withName: 'Jordan Rivera', whenLabel: 'Mon, Aug 4, 2:00 PM ET', reason: 'Partnership intro', notes: 'Looking forward to it!', zoomUrl: 'https://zoom.us/j/sample' } },
    { template: 'event_registered', data: { title: 'Weekly Referral Room', whenLabel: 'Thu, Aug 7, 12:00 PM ET', eventUrl: `${site}/events`, zoomUrl: 'https://zoom.us/j/sample' } },
  ];
  const sent: EmailTemplate[] = [];
  for (const s of samples) {
    await sendEmail({ to, template: s.template, data: { ...s.data, _preview: true } });
    sent.push(s.template);
  }
  return sent;
}
