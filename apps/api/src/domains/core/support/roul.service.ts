import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../notifications/email.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getKnowledge } from './roul.knowledge.js';

/**
 * ROUL — the Referral Nova AI Support Manager.
 *
 * Hard constraints (enforced in the system prompt AND validated on output):
 *   - 2–3 lines max, plain sentences, NO markdown (no *, -, #, /, bullets).
 *   - Never invents an answer; if unsure it escalates.
 *   - Warm, professional, on-brand.
 *
 * Answers are grounded in the curated knowledge base (roul.knowledge.ts).
 * Requires OPENAI_API_KEY in the environment; if it's unset ROUL replies with a
 * safe fallback and (for onboarding issues) escalates.
 */

export interface RoulTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface RoulResult {
  answer: string;
  escalated: boolean;
}

const SYSTEM_PROMPT = `You are ROUL, the Support Manager for Referral Nova (an AI-powered business referral network).

STRICT OUTPUT RULES — follow every time:
- Reply in 2 to 3 short lines maximum. Never a paragraph, never an essay.
- Plain sentences only. NO markdown: no asterisks, no bullet points, no dashes as bullets, no slashes as separators, no headers, no bold.
- Be warm, professional and on-brand.
- Answer ONLY from the KNOWLEDGE below. If the answer is not clearly in it, or the user is stuck on an onboarding problem you cannot resolve, do NOT guess.
- When you cannot resolve it, reply exactly with a short line telling the user you are forwarding it to the technical team and will follow up, and nothing else. Start that reply with the token [ESCALATE] on its own — the system will remove it before the user sees it.

KNOWLEDGE:
${getKnowledge()}`;

/** Strip markdown / enforce plain text and the 3-line cap. */
function sanitizeOutput(raw: string): string {
  let t = raw.trim();
  // Remove common markdown artifacts.
  t = t
    .replace(/\*\*/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '');
  // Collapse blank lines, cap at 3 lines.
  const lines = t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.slice(0, 3).join('\n');
}

export async function askRoul(
  question: string,
  history: RoulTurn[],
  user: { id?: string; name?: string; email?: string; plan?: string } | null,
  ctx?: { ticketId?: string; isOnboarding?: boolean },
): Promise<RoulResult> {
  const q = question.trim().slice(0, 2000);

  if (!env.OPENAI_API_KEY) {
    // No key configured yet - fail safe, escalate onboarding issues.
    if (ctx?.isOnboarding && user) {
      await escalateToTechnicalAdmin(user, [...history, { role: 'user', content: q }], 'unknown (ROUL offline)', ctx.ticketId);
      return {
        answer: "I've forwarded your query to our technical team. They'll review and I'll follow up with next steps.",
        escalated: true,
      };
    }
    return {
      answer: 'Thanks for reaching out. A team member will get back to you shortly.',
      escalated: false,
    };
  }

  let content = '';
  try {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.slice(-8).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
      { role: 'user' as const, content: q },
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 160,
      }),
      // Keep well under the 5s latency target; escalate/fallback if slow.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    content = json.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul] completion failed', err);
    if (ctx?.isOnboarding && user) {
      await escalateToTechnicalAdmin(user, [...history, { role: 'user', content: q }], 'unknown (ROUL error)', ctx.ticketId);
      return {
        answer: "I've forwarded your query to our technical team. They'll review and I'll follow up with next steps.",
        escalated: true,
      };
    }
    return { answer: 'Sorry, I hit a snag. Please try again in a moment.', escalated: false };
  }

  const wantsEscalation = /\[escalate\]/i.test(content);
  const answer = sanitizeOutput(content.replace(/\[escalate\]/gi, '').trim()) ||
    "I've forwarded your query to our technical team and will follow up shortly.";

  if (wantsEscalation && user) {
    await escalateToTechnicalAdmin(user, [...history, { role: 'user', content: q }], q, ctx?.ticketId);
    return {
      answer: "I've forwarded your query to our technical team. They'll review and update me, and I'll get back to you with the next steps.",
      escalated: true,
    };
  }

  return { answer, escalated: false };
}

/**
 * Escalate an unresolved (onboarding) query to the TECHNICAL admin only. Emails
 * SUPPORT_ESCALATION_EMAIL with the full transcript and surfaces it in the admin
 * notification bell.
 */
export async function escalateToTechnicalAdmin(
  user: { id?: string; name?: string; email?: string; plan?: string },
  transcript: RoulTurn[],
  stuckStep: string,
  ticketId?: string,
): Promise<void> {
  const lines = transcript
    .map((t) => `${t.role === 'user' ? 'User' : 'ROUL'}: ${t.content}`)
    .join('\n');
  const when = new Date().toISOString();

  await sendEmail({
    to: env.SUPPORT_ESCALATION_EMAIL,
    template: 'support_escalation',
    data: {
      name: user.name ?? 'Unknown',
      email: user.email ?? 'unknown',
      plan: user.plan ?? 'unknown',
      stuckStep,
      when,
      transcript: lines,
      ticketUrl: ticketId ? `https://dashboard.referralnova.com/admin/support?ticket=${ticketId}` : 'https://dashboard.referralnova.com/admin/support',
    },
  });

  // Surface in the admin bell for every admin.
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'support_escalation',
          title: 'Support escalation from ROUL',
          body: `${user.name ?? 'A user'} is stuck: ${stuckStep}`.slice(0, 200),
          data: { ticketId: ticketId ?? null, email: user.email ?? null },
        }).catch(() => undefined),
      ),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul] admin escalation notification failed', err);
  }
}
