import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { SYSTEM_ACCOUNT_EMAILS } from '../../../config/system-accounts.js';
import { sendEmail } from '../notifications/email.service.js';
import { createNotification } from '../notifications/notifications.service.js';

/**
 * ROUL triage ladder.
 *
 * When ROUL cannot resolve a query from its knowledge, it classifies the issue
 * and routes it:
 *   - system_update_individual — a technical issue affecting THIS user that the
 *     dev team must fix. Filed as a dev-facing System Update Request (admin bell
 *     + ROUL console), no human email.
 *   - system_update_product — a technical issue that likely affects the whole
 *     product / many users. Same, but flagged systemic + higher severity.
 *   - human — anything that needs a person (billing disputes, account decisions,
 *     non-technical). Emailed to SUPPORT_ESCALATION_EMAIL as the final fallback.
 *
 * Systemic auto-detection: if several "individual" system updates of the same
 * category land in a short window, the issue is promoted to product-wide so a
 * real outage is caught fast instead of filed as many separate tickets.
 *
 * Everything fails safe: any classifier error routes to `human` (email), never
 * a silent drop.
 */

export type TriageRoute = 'system_update_individual' | 'system_update_product' | 'human';

export interface TriageDecision {
  route: TriageRoute;
  scope: 'individual' | 'product';
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestedFix: string;
  userMessage: string;
}

interface RoulTurn {
  role: 'user' | 'assistant';
  content: string;
}

const HUMAN_FALLBACK: TriageDecision = {
  route: 'human',
  scope: 'individual',
  category: 'unclassified',
  severity: 'medium',
  summary: 'ROUL could not resolve or classify this query.',
  suggestedFix: 'n/a',
  userMessage:
    "I've forwarded your query to our team. They'll review it and I'll follow up with next steps.",
};

// Systemic auto-detection thresholds.
const SYSTEMIC_WINDOW_MS = 30 * 60 * 1000;
const SYSTEMIC_THRESHOLD = 3; // this request + 2 prior of the same category

const TRIAGE_SYSTEM = `You are a support triage classifier for Referral Nova, an AI-powered business referral network.
The AI agent ROUL has already TRIED and FAILED to resolve the user's issue from its knowledge base and known fixes.
Classify the issue and decide how to route it. Reply with ONLY a JSON object, no prose, no markdown:
{
  "route": "system_update_individual" | "system_update_product" | "human",
  "scope": "individual" | "product",
  "category": "short-kebab-or-word tag, e.g. photo-upload, login, billing, matching",
  "severity": "low" | "medium" | "high" | "critical",
  "summary": "one concise sentence for the dev team describing the issue",
  "suggestedFix": "concrete, technical next step(s) the dev team should take, or 'n/a'",
  "userMessage": "a warm 1-2 sentence reply to show the user; plain text, no markdown"
}
Routing rules:
- system_update_individual: a technical bug or misconfiguration affecting THIS one user that requires a code/system change (e.g. their upload keeps failing, their data renders wrong).
- system_update_product: a technical issue that would affect MANY users or the whole product/setup (e.g. login is broken for everyone, a page errors site-wide, a feature is down).
- human: needs a human's judgement or is non-technical (billing disputes, refunds, account/legal decisions, anything a system change won't fix).
Prefer a system_update route when the issue is clearly technical and fixable by the team; use human only when a person is genuinely required.`;

/** Classify an unresolved issue. Never throws - returns a safe human fallback. */
export async function triageIssue(
  question: string,
  transcript: RoulTurn[],
  _user: { id?: string; name?: string; email?: string } | null,
): Promise<TriageDecision> {
  if (!env.OPENAI_API_KEY) return HUMAN_FALLBACK;
  try {
    const convo = transcript
      .slice(-8)
      .map((t) => `${t.role === 'user' ? 'User' : 'ROUL'}: ${t.content}`)
      .join('\n');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: TRIAGE_SYSTEM },
          { role: 'user', content: `Conversation so far:\n${convo}\n\nLatest issue: ${question}` },
        ],
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? '';
    return normalizeDecision(raw);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul-triage] classify failed', err);
    return HUMAN_FALLBACK;
  }
}

/** Parse + validate the model JSON into a safe TriageDecision. Exported for tests. */
export function normalizeDecision(raw: string): TriageDecision {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(raw.replace(/^```json?/i, '').replace(/```$/, '').trim());
  } catch {
    return HUMAN_FALLBACK;
  }
  const routes: TriageRoute[] = ['system_update_individual', 'system_update_product', 'human'];
  const route = routes.includes(obj.route as TriageRoute) ? (obj.route as TriageRoute) : 'human';
  const severities = ['low', 'medium', 'high', 'critical'] as const;
  const severity = severities.includes(obj.severity as (typeof severities)[number])
    ? (obj.severity as TriageDecision['severity'])
    : 'medium';
  const scope: TriageDecision['scope'] =
    route === 'system_update_product' || obj.scope === 'product' ? 'product' : 'individual';
  const str = (v: unknown, fallback: string) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : fallback;
  return {
    route,
    scope,
    category: str(obj.category, 'unclassified').slice(0, 80),
    severity,
    summary: str(obj.summary, 'ROUL could not resolve this query.'),
    suggestedFix: str(obj.suggestedFix, 'n/a'),
    userMessage: str(obj.userMessage, HUMAN_FALLBACK.userMessage),
  };
}

/**
 * Promote a same-category run of individual system updates to product-wide.
 * If >= SYSTEMIC_THRESHOLD (incl. this one) of the same category arrived within
 * the window, it's likely systemic - raise scope + severity.
 */
async function applySystemicDetection(decision: TriageDecision): Promise<TriageDecision> {
  if (decision.route !== 'system_update_individual') return decision;
  try {
    const since = new Date(Date.now() - SYSTEMIC_WINDOW_MS);
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM "SupportEscalation"
         WHERE "category" = $1 AND "route" LIKE 'system_update%' AND "createdAt" >= $2;`,
      decision.category,
      since,
    );
    const priorCount = Number(rows[0]?.count ?? 0);
    if (priorCount + 1 >= SYSTEMIC_THRESHOLD) {
      return {
        ...decision,
        route: 'system_update_product',
        scope: 'product',
        severity: decision.severity === 'critical' ? 'critical' : 'high',
        summary: `[Auto-flagged systemic: ${priorCount + 1} "${decision.category}" reports in 30 min] ${decision.summary}`,
      };
    }
  } catch {
    /* detection is best-effort */
  }
  return decision;
}

/** Persist the triage record; returns the new row id. */
async function recordTriage(
  decision: TriageDecision,
  user: { name?: string; email?: string } | null,
  transcript: RoulTurn[],
  ticketId?: string,
): Promise<string | null> {
  const lines = transcript
    .map((t) => `${t.role === 'user' ? 'User' : 'ROUL'}: ${t.content}`)
    .join('\n');
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO "SupportEscalation"
         ("id","ticketId","name","email","stuckStep","transcript","route","scope","severity","category","suggestedFix","status")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open')
       RETURNING "id";`,
      ticketId ?? null,
      user?.name ?? null,
      user?.email ?? null,
      decision.summary,
      lines,
      decision.route,
      decision.scope,
      decision.severity,
      decision.category,
      decision.suggestedFix,
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul-triage] record write failed', err);
    return null;
  }
}

/**
 * Classify + route an unresolved query. Returns the user-facing message to show.
 */
export async function routeEscalation(
  user: { id?: string; name?: string; email?: string; plan?: string } | null,
  transcript: RoulTurn[],
  question: string,
  ticketId?: string,
): Promise<{ userMessage: string; decision: TriageDecision }> {
  let decision = await triageIssue(question, transcript, user);
  decision = await applySystemicDetection(decision);
  const escalationId = await recordTriage(decision, user, transcript, ticketId);

  const admins = await prisma.user
    .findMany({
      where: { role: 'ADMIN', deletedAt: null, NOT: { email: { in: SYSTEM_ACCOUNT_EMAILS } } },
      select: { id: true },
    })
    .catch(() => [] as { id: string }[]);

  if (decision.route === 'human') {
    // Final fallback: email the human team + surface in the admin bell.
    const when = new Date().toISOString();
    await sendEmail({
      to: env.SUPPORT_ESCALATION_EMAIL,
      template: 'support_escalation',
      data: {
        name: user?.name ?? 'Unknown',
        email: user?.email ?? 'unknown',
        plan: user?.plan ?? 'unknown',
        stuckStep: decision.summary,
        when,
        transcript: transcript.map((t) => `${t.role}: ${t.content}`).join('\n'),
        ticketUrl: ticketId
          ? `https://dashboard.referralnova.com/admin/support?ticket=${ticketId}`
          : 'https://dashboard.referralnova.com/admin/roul',
      },
    }).catch(() => undefined);
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'support_escalation',
          title: 'Support escalation (needs a human)',
          body: decision.summary.slice(0, 200),
          data: { escalationId, ticketId: ticketId ?? null, route: decision.route },
        }).catch(() => undefined),
      ),
    );
  } else {
    // System update request: dev-facing, no member-facing email.
    const scopeLabel = decision.scope === 'product' ? 'PRODUCT-WIDE' : 'individual';
    await Promise.all(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          type: 'roul_system_request',
          title: `ROUL: system update needed (${scopeLabel}, ${decision.severity})`,
          body: decision.summary.slice(0, 200),
          data: {
            escalationId,
            ticketId: ticketId ?? null,
            route: decision.route,
            severity: decision.severity,
            category: decision.category,
          },
        }).catch(() => undefined),
      ),
    );
  }

  return { userMessage: decision.userMessage, decision };
}
