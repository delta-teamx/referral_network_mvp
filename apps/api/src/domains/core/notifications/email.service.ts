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
  | 'reengagement'
  | 'complete_profile'
  | 'roul_message'
  | 'broadcast'
  | 'member_welcome'
  | 'message_received'
  | 'digest'
  | 'weekly_digest'
  | 'intro_request'
  | 'booking_request'
  | 'booking_canceled'
  | 'booking_reminder'
  | 'booking_rescheduled'
  | 'group_join_request'
  | 'group_request_approved'
  | 'group_invite_welcome';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 or plain
  contentType: string;
}

export interface EmailRequest {
  to: string;
  cc?: string[]; // additional recipients copied on the email (e.g. admins on bookings)
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
      const onboardUrl = `${BRAND.app}/onboarding`;
      const P = (t: string) => `<p style="margin:0 0 14px;">${t}</p>`;
      const steps = [
        `<a href="${onboardUrl}" style="color:${BRAND.blue};text-decoration:none;font-weight:600;">Complete your profile</a> and add a photo`,
        `<a href="${onboardUrl}" style="color:${BRAND.blue};text-decoration:none;font-weight:600;">Record your 60 second intro video</a>`,
        `Review your first AI matches and send an introduction`,
      ];
      return {
        subject: `Welcome to Referral Nova, ${firstName}`,
        text:
          `Hi ${firstName},\n\n` +
          `Thank you for joining Referral Nova, and welcome. You have just taken the first step toward turning your network into a steady source of warm, qualified referrals.\n\n` +
          `Here is how it works. Our AI learns what your business does and who you want to meet, then introduces you to trusted partners whose needs line up with yours, so qualified referrals flow in both directions, week after week.\n\n` +
          `The best way to start is by completing your profile, since that is what our AI uses to find your best matches. It only takes a few minutes.\n\n` +
          `Getting started:\n- Complete your profile and add a photo\n- Record your 60 second intro video\n- Review your first AI matches and send an introduction\n\n` +
          `Open your dashboard: ${dashUrl}\n\n` +
          `The legal bits: Privacy ${BRAND.marketing}/privacy, Terms ${BRAND.marketing}/terms, Disclaimers ${BRAND.marketing}/terms#referral-agreements\n\n` +
          `Thank you for trusting us to help grow your business. We are glad to have you here.\n\nWarm regards,\nThe Referral Nova Team`,
        html: brandedLayout(
          `Welcome to Referral Nova, ${escapeHtml(firstName)}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Thank you for joining Referral Nova, and welcome. You have just taken the first step toward turning your network into a steady source of warm, qualified referrals.`) +
            P(`Here is how it works. Our AI learns what your business does and who you want to meet, then introduces you to trusted partners whose needs line up with yours, so qualified referrals flow in both directions, week after week.`) +
            P(`The best way to start is by completing your profile, since that is what our AI uses to find your best matches. It only takes a few minutes.`) +
            `<p style="margin:0 0 8px;font-weight:700;color:${BRAND.ink};">Getting started</p>` +
            `<ul style="margin:0 0 8px;padding-left:20px;color:#374151;line-height:1.6;">` +
            steps.map((x) => `<li style="margin:0 0 6px;">${x}</li>`).join('') +
            `</ul>` +
            P(`Your dashboard is the best place to begin.`) +
            button('Go to my dashboard', dashUrl) +
            `<p style="margin:8px 0 0;font-size:13px;color:${BRAND.gray};">The legal bits: ` +
            `<a href="${BRAND.marketing}/privacy" style="color:${BRAND.blue};">Privacy Policy</a>, ` +
            `<a href="${BRAND.marketing}/terms" style="color:${BRAND.blue};">Terms of Service</a>, ` +
            `<a href="${BRAND.marketing}/terms#referral-agreements" style="color:${BRAND.blue};">Disclaimers</a></p>` +
            `<div style="margin-top:24px;padding-top:18px;border-top:1px solid ${BRAND.line};">` +
            P(`Thank you for trusting us to help grow your business. We are glad to have you here.`) +
            `<p style="margin:8px 0 0;color:${BRAND.gray};">Warm regards,<br><strong style="color:${BRAND.ink};">The Referral Nova Team</strong></p></div>`,
        ),
      };
    }
    case 'new_signup_admin': {
      const industry = String(d.industry ?? 'Not specified');
      return {
        subject: `New ${appName} member: ${d.name} (${industry})`,
        text: `New member on ${appName}: ${d.name} (${d.email}) - Industry: ${industry}. Admin: ${d.dashboardUrl}`,
        html: brandedLayout(
          'New member joined',
          `<p>A new member just completed onboarding on <strong>${appName}</strong>:</p>
           <p><strong>Name:</strong> ${escapeHtml(String(d.name ?? ''))}<br>
           <strong>Email:</strong> ${escapeHtml(String(d.email ?? ''))}<br>
           <strong>Industry:</strong> ${escapeHtml(industry)}${
             d.businessName ? `<br><strong>Business:</strong> ${escapeHtml(String(d.businessName))}` : ''
           }</p>
           ${cta('Open admin console', String(d.dashboardUrl ?? '#'))}`,
        ),
      };
    }
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
    case 'complete_profile': {
      const firstName = String(d.firstName ?? 'there');
      const onboardUrl = `${BRAND.app}/onboarding`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const paras = [
        `Hi ${escapeHtml(firstName)},`,
        `Thank you for joining Referral Nova. We noticed you have not finished setting up your profile yet, and we wanted to help you get the most out of your account.`,
        `Your profile is what our AI uses to match you with the right partners. Members who add their business details and a clear profile photo get matched first and receive far more introductions, because people connect more readily with a business they can actually see and understand. It only takes about five minutes.`,
        `To finish, add your business details, tell us who you want to meet and who you can refer, and upload a profile photo. As soon as your profile is complete, our AI will start suggesting introductions for you right away.`,
        `Pick up where you left off and complete your profile below.`,
      ];
      return {
        subject: 'Finish setting up your Referral Nova profile',
        text:
          `${paras.join('\n\n')}\n\nComplete your profile: ${onboardUrl}`,
        html: brandedLayout(
          `You're one step away, ${escapeHtml(firstName)}`,
          paras.map(P).join('') + button('Complete my profile', onboardUrl),
        ),
      };
    }
    case 'message_received': {
      const firstName = String(d.firstName ?? 'there');
      const fromName = String(d.fromName ?? 'A member');
      const preview = String(d.preview ?? '');
      const messagesUrl = `${BRAND.app}/dashboard/messages`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const quoted = preview
        ? `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">${escapeHtml(preview)}</div>`
        : '';
      return {
        subject: `${fromName} sent you a message on Referral Nova`,
        text:
          `Hi ${firstName},\n\n` +
          `${fromName} messaged you on Referral Nova.\n\n` +
          (preview ? `"${preview}"\n\n` : '') +
          `Open your messages to reply: ${messagesUrl}`,
        html: brandedLayout(
          `${escapeHtml(fromName)} sent you a message`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`${escapeHtml(fromName)} just messaged you on Referral Nova. A quick reply is often where a referral starts.`) +
            quoted +
            button('Read and reply', messagesUrl),
        ),
      };
    }
    case 'digest': {
      // Batched, offline-only summary of unread messages + intro requests.
      const firstName = String(d.firstName ?? 'there');
      const messageCount = Number(d.messageCount ?? 0);
      const introCount = Number(d.introCount ?? 0);
      const items = Array.isArray(d.items)
        ? (d.items as Array<{ type?: string; title?: string; body?: string }>)
        : [];
      const messagesUrl = `${BRAND.app}/dashboard/messages`;
      const leadsUrl = `${BRAND.app}/dashboard/leads`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;

      const parts: string[] = [];
      if (messageCount > 0) parts.push(`${messageCount} new message${messageCount > 1 ? 's' : ''}`);
      if (introCount > 0) parts.push(`${introCount} intro request${introCount > 1 ? 's' : ''}`);
      const summary = parts.join(' and ') || 'new activity';
      // Send people to whichever inbox has more waiting.
      const primaryUrl = introCount > messageCount ? leadsUrl : messagesUrl;

      const list = items
        .map(
          (it) =>
            `<div style="margin:0 0 10px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;">` +
            `<div style="font-weight:600;color:${BRAND.ink};">${escapeHtml(String(it.title ?? ''))}</div>` +
            (it.body
              ? `<div style="margin-top:2px;color:${BRAND.gray};font-size:14px;">${escapeHtml(String(it.body))}</div>`
              : '') +
            `</div>`,
        )
        .join('');

      return {
        subject: `You have ${summary} on Referral Nova`,
        text:
          `Hi ${firstName},\n\n` +
          `You have ${summary} waiting on Referral Nova.\n\n` +
          items.map((it) => `- ${it.title ?? ''}${it.body ? `: ${it.body}` : ''}`).join('\n') +
          `\n\nOpen Referral Nova to reply: ${primaryUrl}`,
        html: brandedLayout(
          `You have ${summary}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Here's what's been waiting for you on Referral Nova:`) +
            list +
            button('Open Referral Nova', primaryUrl) +
            P(
              `<span style="color:${BRAND.gray};font-size:13px;">You're getting this because you weren't active when these came in. We batch them so you get one summary instead of a flood.</span>`,
            ),
        ),
      };
    }
    case 'weekly_digest': {
      // "Your week with Nova" - a proactive Monday briefing voiced by Nova, the
      // Referral Nova growth-partner persona. Same skeleton every week (network,
      // momentum, needs-attention, standing) and it always ships: a quiet week
      // becomes an encouraging nudge instead of silence.
      const firstName = String(d.firstName ?? 'there');
      const quiet = Boolean(d.quiet);
      const network = (d.network ?? {}) as {
        pendingIntros?: number;
        pendingNames?: string[];
        newMatches?: number;
        matchNames?: string[];
      };
      const momentum = (d.momentum ?? {}) as { newLeads?: number; advanced?: number };
      const attention = (d.attention ?? {}) as {
        staleCards?: number;
        staleNames?: string[];
        agingIntros?: number;
      };
      const standing = (d.standing ?? {}) as { weeklyPoints?: number };

      const app = BRAND.app;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const nameList = (names: string[]) =>
        names.filter(Boolean).slice(0, 3).map(escapeHtml).join(', ');
      // HTML -> plaintext for the text/plain part: drop tags and decode the few
      // entities the copy uses, so the plaintext never shows "&mdash;".
      const plain = (s: string) =>
        s
          .replace(/<[^>]+>/g, '')
          .replace(/&mdash;/g, '—')
          .replace(/&rarr;/g, '→')
          .replace(/&amp;/g, '&');

      // One reusable "card" block: heading, body, and a single next-step link.
      const card = (emoji: string, title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string) =>
        `<div style="margin:0 0 16px;padding:16px 18px;background:${BRAND.bg};border-radius:10px;">` +
        `<div style="font-weight:700;color:${BRAND.ink};font-size:15px;margin-bottom:6px;">${emoji} ${escapeHtml(title)}</div>` +
        `<div style="color:#374151;font-size:14px;line-height:1.55;">${bodyHtml}</div>` +
        `<div style="margin-top:10px;"><a href="${escapeAttr(ctaUrl)}" style="color:${BRAND.blue};font-weight:600;text-decoration:none;font-size:14px;">${escapeHtml(ctaLabel)} &rarr;</a></div>` +
        `</div>`;

      const sections: string[] = [];
      const textLines: string[] = [];

      if (!quiet) {
        // --- Your network -----------------------------------------------------
        const pi = network.pendingIntros ?? 0;
        const nm = network.newMatches ?? 0;
        if (pi > 0 || nm > 0) {
          const bits: string[] = [];
          if (pi > 0) {
            const who = nameList(network.pendingNames ?? []);
            bits.push(
              `<strong>${pi}</strong> ${pi === 1 ? 'person is' : 'people are'} waiting on your reply to connect${who ? ` &mdash; including ${who}` : ''}.`,
            );
          }
          if (nm > 0) {
            const who = nameList(network.matchNames ?? []);
            bits.push(
              `I lined up <strong>${nm}</strong> fresh ${nm === 1 ? 'match' : 'matches'} for you this week${who ? ` (${who}${nm > 3 ? ' and more' : ''})` : ''}.`,
            );
          }
          sections.push(
            card('🤝', 'Your network is warming up', bits.join(' '), 'Review your matches & requests', `${app}/dashboard`),
          );
          textLines.push(`Your network: ${plain(bits.join(' '))}`);
        }

        // --- Momentum ---------------------------------------------------------
        const nl = momentum.newLeads ?? 0;
        const adv = momentum.advanced ?? 0;
        if (nl > 0 || adv > 0) {
          const bits: string[] = [];
          if (nl > 0) bits.push(`<strong>${nl}</strong> new ${nl === 1 ? 'lead' : 'leads'} landed in your pipeline`);
          if (adv > 0) bits.push(`<strong>${adv}</strong> ${adv === 1 ? 'deal' : 'deals'} moved forward`);
          sections.push(
            card('📈', 'Momentum this week', `${bits.join(' and ')}. Nice work — keep them moving.`, 'Open your pipeline', `${app}/dashboard/leads`),
          );
          textLines.push(`Momentum: ${plain(bits.join(' and '))}.`);
        }

        // --- Needs attention --------------------------------------------------
        const sc = attention.staleCards ?? 0;
        const ai = attention.agingIntros ?? 0;
        if (sc > 0 || ai > 0) {
          const bits: string[] = [];
          if (sc > 0) {
            const who = nameList(attention.staleNames ?? []);
            bits.push(
              `<strong>${sc}</strong> open ${sc === 1 ? 'deal has' : 'deals have'} gone quiet for two weeks${who ? ` (${who})` : ''}`,
            );
          }
          if (ai > 0) bits.push(`<strong>${ai}</strong> intro ${ai === 1 ? 'request has' : 'requests have'} been waiting a few days`);
          sections.push(
            card('⏰', 'A little attention needed', `${bits.join(', and ')}. A quick nudge often restarts a stalled conversation.`, 'Follow up now', `${app}/dashboard/leads`),
          );
          textLines.push(`Needs attention: ${plain(bits.join(', and '))}.`);
        }

        // --- Standing ---------------------------------------------------------
        const pts = standing.weeklyPoints ?? 0;
        if (pts > 0) {
          sections.push(
            card('🏆', 'Your standing', `You earned <strong>${pts}</strong> contribution ${pts === 1 ? 'point' : 'points'} this week. Every referral you give lifts your rank.`, 'See the leaderboard', `${app}/dashboard/leaderboard`),
          );
          textLines.push(`Standing: earned ${pts} contribution points this week.`);
        }
      }

      // Quiet-week fallback: never send an empty email - turn it into a nudge.
      if (quiet || sections.length === 0) {
        sections.length = 0;
        sections.push(
          card(
            '✨',
            'A fresh week, a clean slate',
            `It was quiet on your end this week — which is the perfect moment to get ahead. Invite a connection, complete your profile, or check the matches I've found for you. Small moves now become referrals later.`,
            'Explore your matches',
            `${app}/dashboard`,
          ),
        );
        textLines.push('A quiet week - a great moment to invite a connection or review your matches.');
      }

      const intro = quiet
        ? `It was a calm week — here's a simple way to build momentum:`
        : `Here's what I noticed for you this week:`;

      const bodyHtml =
        P(`Hi ${escapeHtml(firstName)}, happy Monday! 👋`) +
        P(`I'm Nova — I keep an eye on your network so you can focus on the conversations that matter. ${intro}`) +
        sections.join('') +
        P(
          `<span style="color:${BRAND.gray};font-size:13px;">I'm always learning what's most useful to you — just reply and tell me what you'd like to see here.</span>`,
        ) +
        P(`Cheering you on,<br><strong>Nova</strong> · your growth partner at Referral Nova`);

      return {
        subject: quiet
          ? `Your week ahead on Referral Nova, ${firstName}`
          : `Your Referral Nova week: what needs your attention`,
        text:
          `Hi ${firstName}, happy Monday!\n\n` +
          `I'm Nova, your growth partner at Referral Nova. ${plain(intro)}\n\n` +
          textLines.map((l) => `- ${l}`).join('\n') +
          `\n\nJump back in: ${app}/dashboard\n\n` +
          `Reply anytime to tell me what you'd like to see.\n\nCheering you on,\nNova`,
        html: brandedLayout(quiet ? 'Your week ahead' : 'Your week with Nova', bodyHtml),
      };
    }
    case 'intro_request': {
      const firstName = String(d.firstName ?? 'there');
      const fromName = String(d.fromName ?? 'A member');
      const reason = d.reason ? String(d.reason) : '';
      const url = `${BRAND.app}/dashboard/leads`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `${fromName} wants to connect on Referral Nova`,
        text:
          `Hi ${firstName},\n\n${fromName} would like an introduction on Referral Nova.\n\n` +
          (reason ? `${reason}\n\n` : '') +
          `Accept the request to start the conversation: ${url}`,
        html: brandedLayout(
          `${escapeHtml(fromName)} wants to connect`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`${escapeHtml(fromName)} would like an introduction. Accepting opens a direct conversation, which is where referrals start.`) +
            (reason ? `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">${escapeHtml(reason)}</div>` : '') +
            button('Review the request', url),
        ),
      };
    }
    case 'booking_request': {
      const firstName = String(d.firstName ?? 'there');
      const fromName = String(d.fromName ?? 'A member');
      const whenLabel = String(d.whenLabel ?? '');
      const url = `${BRAND.app}/dashboard/bookings`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `${fromName} requested a call with you`,
        text:
          `Hi ${firstName},\n\n${fromName} requested a call${whenLabel ? ` on ${whenLabel}` : ''}.\n\n` +
          `Accept or decline in your Bookings tab: ${url}`,
        html: brandedLayout(
          `${escapeHtml(fromName)} requested a call`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`${escapeHtml(fromName)} would like to meet${whenLabel ? ` on <strong>${escapeHtml(whenLabel)}</strong>` : ''}. Accept and we'll set up the Zoom link automatically.`) +
            button('Review the request', url),
        ),
      };
    }
    case 'booking_canceled': {
      const firstName = String(d.firstName ?? 'there');
      const withName = String(d.withName ?? 'a member');
      const whenLabel = String(d.whenLabel ?? '');
      const url = `${BRAND.app}/dashboard/bookings`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `Your call with ${withName} was canceled`,
        text:
          `Hi ${firstName},\n\nYour call with ${withName}${whenLabel ? ` on ${whenLabel}` : ''} has been canceled.\n\n` +
          `You can rebook anytime: ${url}`,
        html: brandedLayout(
          'A call was canceled',
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Your call with ${escapeHtml(withName)}${whenLabel ? ` on <strong>${escapeHtml(whenLabel)}</strong>` : ''} has been canceled.`) +
            P(`No problem - you can rebook whenever it suits you both.`) +
            button('Go to bookings', url),
        ),
      };
    }
    case 'booking_reminder': {
      const firstName = String(d.firstName ?? 'there');
      const withName = String(d.withName ?? 'a member');
      const whenLabel = String(d.whenLabel ?? '');
      const startsInLabel = String(d.startsInLabel ?? 'soon');
      const zoomUrl = String(d.zoomUrl ?? '');
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `Reminder: your call with ${withName} starts ${startsInLabel}`,
        text:
          `Hi ${firstName},\n\n` +
          `This is a reminder that your call with ${withName}${whenLabel ? ` on ${whenLabel}` : ''} starts ${startsInLabel}.\n\n` +
          (zoomUrl ? `Join here: ${zoomUrl}\n\n` : '') +
          `See you there!`,
        html: brandedLayout(
          `Your call starts ${escapeHtml(startsInLabel)}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Just a reminder that your call with <strong>${escapeHtml(withName)}</strong>${whenLabel ? ` on <strong>${escapeHtml(whenLabel)}</strong>` : ''} starts <strong>${escapeHtml(startsInLabel)}</strong>.`) +
            (zoomUrl ? button('Join the call', zoomUrl) : '') +
            P(`<span style="color:#888;font-size:12px">The calendar invite is attached.</span>`),
        ),
      };
    }
    case 'booking_rescheduled': {
      const firstName = String(d.firstName ?? 'there');
      const withName = String(d.withName ?? 'a member');
      const oldWhenLabel = String(d.oldWhenLabel ?? '');
      const whenLabel = String(d.whenLabel ?? '');
      const zoomUrl = String(d.zoomUrl ?? '');
      const url = `${BRAND.app}/dashboard/bookings`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `Your call with ${withName} was moved to ${whenLabel}`,
        text:
          `Hi ${firstName},\n\n` +
          `Your call with ${withName} has been rescheduled${oldWhenLabel ? ` from ${oldWhenLabel}` : ''} to ${whenLabel}.\n\n` +
          (zoomUrl ? `The same Zoom link still works: ${zoomUrl}\n\n` : '') +
          `View it in your bookings: ${url}`,
        html: brandedLayout(
          'Your call was rescheduled',
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Your call with <strong>${escapeHtml(withName)}</strong> has been moved${oldWhenLabel ? ` from <strong>${escapeHtml(oldWhenLabel)}</strong>` : ''} to <strong>${escapeHtml(whenLabel)}</strong>.`) +
            (zoomUrl ? P(`The same Zoom link still works.`) : '') +
            button('View booking', url) +
            P(`<span style="color:#888;font-size:12px">An updated calendar invite is attached.</span>`),
        ),
      };
    }
    case 'group_join_request': {
      // Sent to a group leader/co-leader when someone requests to join.
      const firstName = String(d.firstName ?? 'there');
      const applicantName = String(d.applicantName ?? 'A member');
      const groupName = String(d.groupName ?? 'your group');
      const note = d.note ? String(d.note) : '';
      const url = String(d.reviewUrl ?? `${BRAND.app}/dashboard/groups`);
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `${applicantName} asked to join ${groupName}`,
        text:
          `Hi ${firstName},\n\n${applicantName} has requested to join ${groupName}.\n\n` +
          (note ? `Their note: ${note}\n\n` : '') +
          `Review and approve the request here: ${url}`,
        html: brandedLayout(
          `New request to join ${escapeHtml(groupName)}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`<strong>${escapeHtml(applicantName)}</strong> has requested to join <strong>${escapeHtml(groupName)}</strong>.`) +
            (note ? `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">${escapeHtml(note)}</div>` : '') +
            P(`Approve them to add them to the group, or leave it pending.`) +
            button('Review the request', url),
        ),
      };
    }
    case 'group_request_approved': {
      // Sent to a member when a leader approves their request - the "you're in".
      const firstName = String(d.firstName ?? 'there');
      const groupName = String(d.groupName ?? 'the group');
      const url = String(d.groupUrl ?? `${BRAND.app}/dashboard/groups`);
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `You're in - welcome to ${groupName}`,
        text:
          `Hi ${firstName},\n\nGreat news - your request to join ${groupName} was approved. You're in!\n\n` +
          `Open the group to meet members and see what's happening: ${url}`,
        html: brandedLayout(
          `You're in - welcome to ${escapeHtml(groupName)}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`Great news - your request to join <strong>${escapeHtml(groupName)}</strong> was approved. You're officially in.`) +
            P(`Open the group to meet the other members, see upcoming events, and join the conversation.`) +
            button('Open the group', url),
        ),
      };
    }
    case 'group_invite_welcome': {
      // Sent when someone joins through the shared invite link (auto-approved).
      const firstName = String(d.firstName ?? 'there');
      const groupName = String(d.groupName ?? 'the group');
      const premium = d.premium === true;
      const url = String(d.groupUrl ?? `${BRAND.app}/dashboard/groups`);
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      return {
        subject: `Welcome to ${groupName}`,
        text:
          `Hi ${firstName},\n\nYou've joined ${groupName}.` +
          (premium ? ` As a launch member, lifetime Premium access is now unlocked on your account.` : '') +
          `\n\nOpen the group to get started: ${url}`,
        html: brandedLayout(
          `Welcome to ${escapeHtml(groupName)}`,
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`You've joined <strong>${escapeHtml(groupName)}</strong>. Welcome aboard!`) +
            (premium
              ? `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">As a launch member, <strong>lifetime Premium access</strong> is now unlocked on your account - every paid feature, on us.</div>`
              : '') +
            button('Open the group', url),
        ),
      };
    }
    case 'roul_message': {
      const firstName = String(d.firstName ?? 'there');
      const messageText = String(d.message ?? '');
      const messagesUrl = `${BRAND.app}/dashboard/messages`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const quoted = `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">${escapeHtml(messageText).replace(/\n/g, '<br/>')}</div>`;
      return {
        subject: 'ROUL Support sent you a message',
        text:
          `Hi ${firstName},\n\n` +
          `ROUL Support (the Referral Nova team) sent you a message:\n\n` +
          `${messageText}\n\n` +
          `Open your Messages to read it and reply: ${messagesUrl}`,
        html: brandedLayout(
          'You have a new message from ROUL Support',
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`The Referral Nova team (ROUL Support) just sent you a message:`) +
            quoted +
            P(`Open your Messages to read it and reply. We will get right back to you.`) +
            button('Open my messages', messagesUrl),
        ),
      };
    }
    case 'broadcast': {
      const firstName = String(d.firstName ?? 'there');
      const senderName = String(d.senderName ?? 'The Referral Nova team');
      const senderTitle = String(d.senderTitle ?? '');
      const subject = String(d.subject ?? 'A message from Referral Nova');
      const messageText = String(d.message ?? '');
      const messagesUrl = `${BRAND.app}/dashboard/messages`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const fromLine = senderTitle ? `${senderName}, ${senderTitle}` : senderName;
      const quoted = `<div style="margin:0 0 16px;padding:12px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.blue};border-radius:6px;color:${BRAND.ink};">${escapeHtml(messageText).replace(/\n/g, '<br/>')}</div>`;
      return {
        subject,
        text:
          `Hi ${firstName},\n\n` +
          `${fromLine} sent an announcement to the Referral Nova community:\n\n` +
          `${subject}\n\n${messageText}\n\n— ${fromLine}\n\n` +
          `You can also read it in your Messages: ${messagesUrl}`,
        html: brandedLayout(
          escapeHtml(subject),
          P(`Hi ${escapeHtml(firstName)},`) +
            P(`${escapeHtml(fromLine)} sent an announcement to the Referral Nova community:`) +
            quoted +
            P(`— ${escapeHtml(fromLine)}`) +
            button('Open Referral Nova', messagesUrl),
        ),
      };
    }
    case 'member_welcome': {
      const firstName = String(d.firstName ?? 'there');
      const subject = String(d.subject ?? 'Welcome to Referral Nova!');
      const messageText = String(d.message ?? '');
      const dashUrl = `${BRAND.app}/dashboard`;
      const P = (s: string) => `<p style="margin:0 0 14px;">${s}</p>`;
      const bodyHtml = escapeHtml(messageText).replace(/\n/g, '<br/>');
      return {
        subject,
        text:
          `Hi ${firstName},\n\n` +
          `${messageText}\n\n` +
          `— The Referral Nova Team\n\n` +
          `Open your dashboard: ${dashUrl}`,
        html: brandedLayout(
          escapeHtml(subject),
          P(`Hi ${escapeHtml(firstName)},`) +
            P(bodyHtml) +
            P(`— The Referral Nova Team`) +
            button('Open my dashboard', dashUrl),
        ),
      };
    }
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
            `A few days ago you set up your profile on Referral Nova, and we wanted to reach out personally. Getting your profile live is the hard part, and you have already done it. The real value begins when you come back and start engaging with the network you have joined.\n\n` +
            `Since you signed up, our AI matching engine has been working quietly in the background, looking for business owners whose needs line up with what you do and who you want to meet. Referral Nova was built to turn your network into a steady source of warm, qualified referrals that flow in both directions, week after week, rather than something you have to chase.\n\n` +
            `Right now, all of that is waiting for you inside your dashboard: the members you should meet, the introductions you can request, and the businesses ready to send work your way. It only takes a few minutes to log back in, review your suggested matches, and start a conversation or two.\n\n` +
            `Your seat is still here, and so is everything you set up. Come and see who is waiting to meet you.`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`A few days ago you set up your profile on Referral Nova, and we wanted to reach out personally. Getting your profile live is the hard part, and you have already done it. The real value begins when you come back and start engaging with the network you have joined.`) +
            P(`Since you signed up, our AI matching engine has been working quietly in the background, looking for business owners whose needs line up with what you do and who you want to meet. Referral Nova was built to turn your network into a steady source of warm, qualified referrals that flow in both directions, week after week, rather than something you have to chase.`) +
            P(`Right now, all of that is waiting for you inside your dashboard: the members you should meet, the introductions you can request, and the businesses ready to send work your way. It only takes a few minutes to log back in, review your suggested matches, and start a conversation or two.`) +
            P(`Your seat is still here, and so is everything you set up. Come and see who is waiting to meet you.`),
        },
        7: {
          subject: 'Introductions are waiting for you on Referral Nova',
          heading: `Here's what's happening in your network, ${escapeHtml(firstName)}`,
          cta: 'See my matches',
          bodyText:
            `Hi ${firstName},\n\n` +
            `It has been about a week since you last visited Referral Nova, and we wanted to follow up, because you are genuinely missing out on the reason you joined.\n\n` +
            `Referrals are the highest converting business you can get. A warm introduction from a trusted peer closes far more often than any cold lead or ad. That is exactly what Referral Nova is designed to generate for you on a recurring basis. Our AI identifies the right partners, suggests introductions with a clear reason for the match, and gives you the tools to meet over Zoom, track your referrals, and even sign simple referral agreements on the platform.\n\n` +
            `While you have been away, the network has kept moving. Members are being matched, introductions are being made, and referrals are being exchanged. Every week you are not active is a week those opportunities go to someone else.\n\n` +
            `Take five minutes to log back in, review the matches our AI has lined up for you, and send your first introduction request. We think you will be glad you did.`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`It has been about a week since you last visited Referral Nova, and we wanted to follow up, because you are genuinely missing out on the reason you joined.`) +
            P(`Referrals are the highest converting business you can get. A warm introduction from a trusted peer closes far more often than any cold lead or ad. That is exactly what Referral Nova is designed to generate for you on a recurring basis. Our AI identifies the right partners, suggests introductions with a clear reason for the match, and gives you the tools to meet over Zoom, track your referrals, and even sign simple referral agreements on the platform.`) +
            P(`While you have been away, the network has kept moving. Members are being matched, introductions are being made, and referrals are being exchanged. Every week you are not active is a week those opportunities go to someone else.`) +
            P(`Take five minutes to log back in, review the matches our AI has lined up for you, and send your first introduction request. We think you will be glad you did.`),
        },
        14: {
          subject: "We'd love to see you back on Referral Nova",
          heading: `Still growing your business through referrals, ${escapeHtml(firstName)}?`,
          cta: 'Come back to Referral Nova',
          bodyText:
            `Hi ${firstName},\n\n` +
            `It has been a couple of weeks since you set up your profile, and we wanted to check in and see how you are getting on.\n\n` +
            `Everything you set up is still here and ready for you. Your profile and your matches are waiting, and nothing has been lost. Referral Nova exists to make referrals happen on purpose rather than by luck, and that works best when you are an active part of the network, meeting the partners our AI surfaces for you and exchanging introductions with people who can genuinely move your business forward.\n\n` +
            `If now is not the right time, we completely understand, and your account will be here whenever you are ready to pick it back up. If you have been meaning to give it a proper look, this is a great moment. Log in, spend ten minutes reviewing your matches, and start one conversation. That single step is usually what turns a quiet account into real referrals.\n\n` +
            `Thank you for joining Referral Nova. We would love to see you back.\n\n` +
            `The Referral Nova Team`,
          bodyHtml:
            P(`Hi ${escapeHtml(firstName)},`) +
            P(`It has been a couple of weeks since you set up your profile, and we wanted to check in and see how you are getting on.`) +
            P(`Everything you set up is still here and ready for you. Your profile and your matches are waiting, and nothing has been lost. Referral Nova exists to make referrals happen on purpose rather than by luck, and that works best when you are an active part of the network, meeting the partners our AI surfaces for you and exchanging introductions with people who can genuinely move your business forward.`) +
            P(`If now is not the right time, we completely understand, and your account will be here whenever you are ready to pick it back up. If you have been meaning to give it a proper look, this is a great moment. Log in, spend ten minutes reviewing your matches, and start one conversation. That single step is usually what turns a quiet account into real referrals.`) +
            P(`Thank you for joining Referral Nova. We would love to see you back.`) +
            `<p style="margin:0 0 4px;color:${BRAND.gray};">The Referral Nova Team</p>`,
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

/** Branded, mobile-responsive, table-based layout shared by every email. */
function brandedLayout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<style>
  /* Mobile: tighten padding and scale text so the email is comfortable on phones. */
  @media only screen and (max-width:600px) {
    .rn-shell { padding: 12px 8px !important; }
    .rn-head { padding: 18px 18px !important; }
    .rn-card { padding: 24px 18px !important; }
    .rn-foot { padding: 18px 18px 24px !important; }
    .rn-h1 { font-size: 20px !important; line-height: 1.3 !important; }
    .rn-body { font-size: 15px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};"><tr><td align="center" class="rn-shell" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td class="rn-head" style="background:${BRAND.blue};border-radius:14px 14px 0 0;padding:22px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#ffffff;color:${BRAND.blue};border-radius:9px;font-weight:800;font-size:15px;">RN</span></td>
          <td style="vertical-align:middle;padding-left:12px;"><span style="color:#ffffff;font-weight:800;font-size:18px;">Referral Nova</span></td>
        </tr></table>
      </td></tr>
      <tr><td class="rn-card" style="background:#ffffff;padding:32px 28px;">
        <h1 class="rn-h1" style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${BRAND.ink};">${heading}</h1>
        <div class="rn-body" style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
      </td></tr>
      <tr><td class="rn-foot" style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid ${BRAND.line};padding:20px 28px 28px;">${legalFooter()}</td></tr>
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

/** Small secondary (outline) buttons that WRAP on narrow screens (inline-block,
 *  not fixed table cells) so they never overflow on mobile. */
function secondaryButtons(items: { label: string; url: string }[]): string {
  return `<div style="margin:8px 0 4px;line-height:2.4;">${items
    .map(
      (i) =>
        `<a href="${escapeAttr(i.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:1px solid ${BRAND.line};border-radius:8px;color:${BRAND.blue};text-decoration:none;font-weight:600;font-size:13px;">${escapeHtml(i.label)}</a>`,
    )
    .join('')}</div>`;
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
      Referral Nova, the AI-powered referral network for businesses.<br>
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
    console.log(
      `[email:${req.template}] to ${req.to}${req.cc?.length ? ` cc ${req.cc.join(', ')}` : ''} · from ${env.EMAIL_FROM}`,
    );
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
    if (req.cc && req.cc.length > 0) body.cc = req.cc;
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
      cc: req.cc && req.cc.length > 0 ? req.cc : undefined,
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

/**
 * Send an email, PROPAGATING any provider failure to the caller. Use this when
 * the caller needs to know whether delivery actually succeeded (e.g. the digest
 * job, which must not advance its cursor past an email it never sent).
 */
export async function sendEmailStrict(req: EmailRequest): Promise<void> {
  const p = await getProvider();
  await p.send(req);
}

/** Queue an email for delivery. Never throws - failures are logged. Use this
 *  for fire-and-forget transactional mail where a failure shouldn't break the
 *  request path. */
export async function sendEmail(req: EmailRequest): Promise<void> {
  try {
    await sendEmailStrict(req);
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
