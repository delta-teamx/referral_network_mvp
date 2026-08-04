import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { sendEmail } from '../notifications/email.service.js';
import { createNotification } from '../notifications/notifications.service.js';
import { getKnowledge } from './roul.knowledge.js';
import { retrieveKnowledge } from './roul.rag.js';
import { routeEscalation } from './roul.triage.js';

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

/**
 * The default ROUL instructions (persona + output rules). Admins can override
 * this from the ROUL console without a deploy; this stays the fallback.
 */
export const DEFAULT_ROUL_INSTRUCTIONS = `You are ROUL, the Support Manager for Referral Nova (an AI-powered business referral network). You are a genuinely helpful first responder who tries to SOLVE the member's problem, not a switchboard that forwards tickets.

HOW TO HELP (this is your primary job — do this first, every time):
- If the member's message is vague or missing details (for example "I'm facing an issue with suggestions" or "something is broken"), ASK ONE short, friendly clarifying question to understand exactly what is happening. Never escalate on a first vague message — engage with it.
- CHECK THEIR ACCOUNT: you are given a private MEMBER ACCOUNT CONTEXT below. Always use it to give a SPECIFIC diagnosis rooted in their actual account, not generic advice.
- Once you understand the issue, answer it from the KNOWLEDGE, grounded in their account context.

DIAGNOSING "AI SUGGESTIONS / MATCHES ARE NOT SHOWING" (a common one — use the account context):
- If onboarding is INCOMPLETE, or the profile is MISSING, or the profile has no services listed or no ideal-customer profile set: that is exactly why there are no matches. Tell them warmly that matches are generated from their profile, and point them to Profile settings to complete it — matches then appear within a day.
- If their profile is complete but the account is only a day or two old and suggestions count is 0: reassure them that AI matches refresh every few hours and should populate shortly.
- If their profile is complete, the account is several days old, AND suggestions count is still 0: that is a genuine technical problem on our side. Do NOT suggest browser refreshes — escalate to the team.
- If suggestions count is greater than 0 but they still can't see them: it's a display issue; a single hard refresh is worth ONE try, then escalate.

NEVER LOOP:
- Do not suggest the same fix twice, and never run a member through a chain of generic browser fixes (refresh, clear cache, incognito, log out and back in). That is not support.
- If the account context shows the data is genuinely missing, or the member says "still not working" after ONE real attempt, STOP troubleshooting and escalate — with a short, honest line that you're bringing in the team to look at their account.

OUTPUT RULES — follow every time:
- Reply in 2 to 3 short lines maximum. Never a paragraph, never an essay.
- Plain sentences only. NO markdown: no asterisks, no bullet points, no dashes as bullets, no slashes as separators, no headers, no bold.

ESCALATION:
- Escalate only after you have genuinely tried to help using their account context — but DO escalate promptly once it's clear the issue is on our side or a real fix isn't within the member's reach. Do not stall them with repeated generic steps.
- To escalate, reply with one short line telling the member you're bringing in the team to look at their account, and start that reply with the token [ESCALATE] on its own (the system removes it before the member sees it).`;

const INSTRUCTIONS_KEY = 'roul_system_prompt';
let instructionsCache: { text: string; at: number } | null = null;
const INSTRUCTIONS_TTL_MS = 60_000;

/**
 * The active instructions - an admin override from AppSetting if present, else
 * the default. Cached for 60s so edits propagate within a minute (no deploy)
 * without a DB read on every question.
 */
export async function getRoulInstructions(): Promise<string> {
  const now = Date.now();
  if (instructionsCache && now - instructionsCache.at < INSTRUCTIONS_TTL_MS) {
    return instructionsCache.text;
  }
  let text = DEFAULT_ROUL_INSTRUCTIONS;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: INSTRUCTIONS_KEY } });
    const override =
      row && typeof row.value === 'object' && row.value
        ? (row.value as { text?: string }).text
        : undefined;
    if (override && override.trim()) text = override.trim();
  } catch {
    /* fall back to default */
  }
  instructionsCache = { text, at: now };
  return text;
}

/** Save admin-edited instructions (or reset to default when text is empty). */
export async function setRoulInstructions(text: string | null): Promise<void> {
  const clean = (text ?? '').trim();
  await prisma.appSetting.upsert({
    where: { key: INSTRUCTIONS_KEY },
    create: { key: INSTRUCTIONS_KEY, value: { text: clean } },
    update: { value: { text: clean } },
  });
  instructionsCache = null; // force reload
}

/**
 * A non-negotiable escalation clause appended to EVERY system prompt, whatever
 * the (admin-editable) instructions say. This guarantees ROUL never silently
 * loses its ability to escalate because a prompt rewrite dropped the token.
 */
const MANDATORY_ESCALATION_CLAUSE = `

ESCALATION SAFETY RULE (always applies): Escalation is a LAST resort, never a first response. If the member's message is unclear, ask a short clarifying question instead of escalating. Try to solve it from the KNOWLEDGE and any relevant known fix first. ONLY when you have genuinely tried to help and truly cannot resolve it (and further questions won't help) may you escalate — reply with one short line saying you're bringing in the team, beginning with the token [ESCALATE] on its own line (the system removes it before the member sees it). Do not escalate on a vague first message; ask what's happening instead.`;

/**
 * Build the system prompt for a turn. `knowledge` is the grounding text - either
 * the top-K chunks retrieved from the pgvector store (RAG) or, as a fallback,
 * the full curated KB. `instructions` is the (possibly admin-edited) persona +
 * rules block. The mandatory escalation clause is always appended.
 */
function buildSystemPrompt(knowledge: string, instructions: string, memberContext: string): string {
  const ctx = memberContext
    ? `\n\nMEMBER ACCOUNT CONTEXT (private facts about the person you're helping — use them to give a SPECIFIC diagnosis; never paste them back verbatim):\n${memberContext}`
    : '';
  return `${instructions}${MANDATORY_ESCALATION_CLAUSE}${ctx}\n\nKNOWLEDGE:\n${knowledge}`;
}

/**
 * A compact, private snapshot of the member's account so ROUL can actually
 * DIAGNOSE ("check their account") instead of guessing generic browser fixes.
 * Best-effort - returns '' on any failure or for anonymous visitors.
 */
async function getMemberContext(userId: string): Promise<string> {
  try {
    const [user, suggestionCount, profile, onboarding] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true, createdAt: true },
      }),
      prisma.introduction.count({
        where: {
          OR: [{ senderId: userId }, { targetId: userId }],
          status: { in: ['suggested', 'requested'] },
        },
      }),
      prisma.memberProfile.findUnique({
        where: { userId },
        select: { photoUrl: true, servicesOffered: true, icpIndustries: true },
      }),
      prisma.onboardingProgress.findUnique({
        where: { userId },
        select: { completedAt: true },
      }),
    ]);
    if (!user) return '';
    const days = Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000);
    const onboarded = Boolean(onboarding?.completedAt || profile);
    const hasIcp = Boolean(profile?.icpIndustries?.length);
    const hasServices = Boolean(profile?.servicesOffered?.length);
    return [
      `Plan: ${user.subscriptionTier}.`,
      `Account age: ${days} day(s).`,
      `Onboarding: ${onboarded ? 'complete' : 'INCOMPLETE'}.`,
      profile
        ? `Profile: present (photo ${profile.photoUrl ? 'yes' : 'no'}, services listed ${hasServices ? 'yes' : 'no'}, ideal-customer profile set ${hasIcp ? 'yes' : 'no'}).`
        : 'Profile: MISSING.',
      `AI suggestions/intros currently generated for this account: ${suggestionCount}.`,
    ].join(' ');
  } catch {
    return '';
  }
}

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
    // No key configured yet - fail safe, triage onboarding issues (routes to a
    // human since the classifier is also offline).
    if (ctx?.isOnboarding && user) {
      const { userMessage } = await routeEscalation(
        user,
        [...history, { role: 'user', content: q }],
        q,
        ctx.ticketId,
      );
      return { answer: userMessage, escalated: true };
    }
    return {
      answer: 'Thanks for reaching out. A team member will get back to you shortly.',
      escalated: false,
    };
  }

  // RAG: ground the answer in the top-K chunks from the pgvector store. If it's
  // unavailable (no pgvector / no store / error) fall back to the full curated
  // KB, so accuracy is never worse than before.
  const [retrieved, instructions, memberContext] = await Promise.all([
    retrieveKnowledge(q),
    getRoulInstructions(),
    user?.id ? getMemberContext(user.id) : Promise.resolve(''),
  ]);
  const knowledge = retrieved && retrieved.length > 0 ? retrieved.join('\n\n') : getKnowledge();

  let content = '';
  try {
    const messages = [
      { role: 'system' as const, content: buildSystemPrompt(knowledge, instructions, memberContext) },
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
    // Any signed-in member (not just onboarding) gets routed to a human on an
    // OpenAI failure - never a dead-end "try again" with no safety net. The
    // triage classifier is also down, so this reliably lands on the human email.
    if (user) {
      const { userMessage } = await routeEscalation(
        user,
        [...history, { role: 'user', content: q }],
        q,
        ctx?.ticketId,
      );
      return { answer: userMessage, escalated: true };
    }
    return { answer: 'Sorry, I hit a snag. Please try again in a moment.', escalated: false };
  }

  const wantsEscalation = /\[escalate\]/i.test(content);
  const answer = sanitizeOutput(content.replace(/\[escalate\]/gi, '').trim()) ||
    "I've forwarded your query to our technical team and will follow up shortly.";

  // ROUL couldn't resolve it - run the triage ladder. It classifies the issue
  // and routes it to a dev-facing System Update Request (individual or
  // product-wide) or, as the final fallback, a human email. The user gets the
  // triage's tailored message.
  if (wantsEscalation) {
    const { userMessage } = await routeEscalation(
      user,
      [...history, { role: 'user', content: q }],
      q,
      ctx?.ticketId,
    );
    return { answer: userMessage, escalated: true };
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

  // Persist to the escalation log so the ROUL admin console can show it.
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SupportEscalation" ("id","ticketId","name","email","stuckStep","transcript")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5);`,
      ticketId ?? null,
      user.name ?? null,
      user.email ?? null,
      stuckStep,
      lines,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul] escalation log write failed', err);
  }

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
