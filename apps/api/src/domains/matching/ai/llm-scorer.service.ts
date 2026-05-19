import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { env } from '../../../config/env.js';

/**
 * LLM-powered match scorer using Claude Opus 4.7 with prompt caching.
 *
 * Architecture:
 *   - System prompt = scoring rubric + "me" profile  → cached (stable for one user's batch)
 *   - User message  = candidate profile             → varies per call
 *
 * The rubric and "me" portion sit before the cache breakpoint, so subsequent
 * calls in the same batch read the prefix from cache (~0.1x cost) and only
 * pay full price for the small candidate-profile delta + output.
 *
 * When ANTHROPIC_API_KEY is unset, isLlmEnabled() returns false and the
 * existing rules engine is the only scoring path.
 */

export interface ProfileSummary {
  userId: string;
  firstName?: string;
  lastName?: string;
  businessName: string;
  industry: string;
  headline: string | null;
  keywords: string[];
  servicesOffered: string[];
  icpIndustries: string[];
  icpRoles: string[];
  canReferIndustries: string[];
  canReferTypes: string[];
  city: string | null;
  state: string | null;
  openToBarter?: boolean;
  barterOfferings?: string[];
  barterWants?: string[];
}

export const LlmMatchScoreSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(100)
    .describe('Match strength on a 0-100 scale where 70-100 is a strong fit, 40-69 is a potential connector, and below 40 is a hidden gem.'),
  tier: z
    .enum(['level1', 'level2', 'level3'])
    .describe('Match tier: level1 (strong fit, 70-100), level2 (potential connector, 40-69), level3 (hidden gem, below 40).'),
  reason: z
    .string()
    .min(20)
    .max(400)
    .describe('One- or two-sentence narrative explaining why these two members should connect. Address the member directly using "you" and "they".'),
  signals: z
    .object({
      industryFit: z.number().min(0).max(10).describe('How well their work aligns with what you want to meet (10 = exact match).'),
      referralPotential: z.number().min(0).max(10).describe('Likelihood of bidirectional client referrals (10 = clear two-way value).'),
      geographicFit: z.number().min(0).max(10).describe('Geographic alignment (10 = same city, 0 = no overlap).'),
      networkValue: z.number().min(0).max(10).describe('Strategic network value even if not a direct referral fit.'),
    })
    .describe('Per-signal breakdown of the score.'),
});

export type LlmMatchScore = z.infer<typeof LlmMatchScoreSchema>;

const RUBRIC = `You are the matchmaking engine for NRG, a referral-driven business networking organization. Your job is to score a candidate connection for the member viewing the dashboard ("you") against a candidate member ("they"), and return a single match assessment.

Scoring rubric (0-100):
- 70-100 (level1, "High match"): Strong industry/service fit. They serve "your" ICP or you serve theirs, and there is a clear two-way referral path or service complement.
- 40-69 (level2, "Potential connector"): Not a direct fit, but their network, geography, or adjacent industry makes them valuable. Includes good barter compatibility.
- 0-39 (level3, "Hidden gem"): Indirect value only — different industry but possible introductions, niche specializations, or long-tail opportunities.

Weight these signals (each 0-10):
- industryFit: Their industry vs. your ICP industries/roles; your industry vs. their ICP.
- referralPotential: Can they refer clients to you? Can you refer to them? Bidirectional is strongest.
- geographicFit: Same city > same state > same region > remote. Only counts heavily for location-bound services.
- networkValue: Strategic adjacency — they connect industries, run groups, or have broader reach.

Compose "reason" as one or two natural sentences from the member's perspective ("you"). Be specific: name their business or industry and the concrete value of the connection. Avoid generic phrases like "great connection" or "valuable network".`;

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cachedClient;
}

export function isLlmEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

function formatProfile(p: ProfileSummary, label: 'you' | 'they'): string {
  const lines: string[] = [];
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  lines.push(`# ${label === 'you' ? 'YOUR profile' : 'THEIR profile'}`);
  if (name) lines.push(`Name: ${name}`);
  lines.push(`Business: ${p.businessName}`);
  lines.push(`Industry: ${p.industry}`);
  if (p.headline) lines.push(`Headline: ${p.headline}`);
  if (p.city || p.state) lines.push(`Location: ${[p.city, p.state].filter(Boolean).join(', ')}`);
  if (p.keywords.length) lines.push(`Keywords: ${p.keywords.join(', ')}`);
  if (p.servicesOffered.length) lines.push(`Services offered: ${p.servicesOffered.join(', ')}`);
  if (p.icpIndustries.length) lines.push(`ICP industries: ${p.icpIndustries.join(', ')}`);
  if (p.icpRoles.length) lines.push(`ICP roles: ${p.icpRoles.join(', ')}`);
  if (p.canReferIndustries.length) lines.push(`Can refer to industries: ${p.canReferIndustries.join(', ')}`);
  if (p.canReferTypes.length) lines.push(`Can refer (types): ${p.canReferTypes.join(', ')}`);
  if (p.openToBarter) {
    if (p.barterOfferings?.length) lines.push(`Barter offerings: ${p.barterOfferings.join(', ')}`);
    if (p.barterWants?.length) lines.push(`Barter wants: ${p.barterWants.join(', ')}`);
  }
  return lines.join('\n');
}

export async function scoreProfilePair(
  me: ProfileSummary,
  them: ProfileSummary,
): Promise<LlmMatchScore | null> {
  const client = getClient();
  if (!client) return null;

  const response = await client.messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      { type: 'text', text: RUBRIC },
      {
        type: 'text',
        text: formatProfile(me, 'you'),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: formatProfile(them, 'they') }],
    output_config: {
      format: zodOutputFormat(LlmMatchScoreSchema),
      effort: 'medium',
    },
  });

  return response.parsed_output ?? null;
}
