import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

/**
 * Feature 3: LinkedIn outreach pipeline. This service is the seam where a
 * Dripify (or native LinkedIn) integration drops scored prospects. Until a
 * real integration is wired, prospects can be ingested via the admin
 * import endpoint (CSV-shaped JSON) and walked through the pipeline by
 * hand.
 *
 * Scoring is rules-based and deliberately conservative — fitScore reflects
 * how well the prospect matches NRG's ICP; leaderScore is a separate
 * "could this person lead a group?" signal as the brief calls out.
 */

export const PROSPECT_STATUSES = [
  'identified',
  'connection_sent',
  'connected',
  'invited',
  'attended',
  'converted',
  'declined',
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export interface ProspectInput {
  fullName: string;
  headline?: string | null;
  linkedInUrl: string;
  industry?: string | null;
  jobRole?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  source?: string;
}

interface ScoringResult {
  fitScore: number;
  leaderScore: number;
  signals: Record<string, number>;
}

// Industries NRG members most commonly serve / want to meet. Out-of-list
// prospects can still score on role/location but lose the industry bonus.
const HIGH_FIT_INDUSTRIES = new Set([
  'real estate',
  'insurance',
  'financial advisory',
  'wealth management',
  'mortgage',
  'home services',
  'legal services',
  'accounting',
  'marketing',
  'construction',
]);

const LEADER_TITLES = [
  'founder',
  'ceo',
  'president',
  'managing partner',
  'owner',
  'principal',
  'broker owner',
  'managing director',
  'partner',
];

const BNI_MARKERS = ['bni', 'networking group', 'chapter leader', 'group leader'];

export function scoreProspect(input: ProspectInput): ScoringResult {
  const signals: Record<string, number> = {};
  const lowerHeadline = (input.headline ?? '').toLowerCase();
  const lowerRole = (input.jobRole ?? '').toLowerCase();
  const lowerIndustry = (input.industry ?? '').toLowerCase();
  const lowerLocation = (input.location ?? input.city ?? '').toLowerCase();

  signals.industryFit = HIGH_FIT_INDUSTRIES.has(lowerIndustry) ? 30 : 0;

  const isSalesyRole = /(sales|business development|account executive|relationship|partner)/.test(lowerRole);
  signals.salesRole = isSalesyRole ? 15 : 0;

  const isOwnerRole = LEADER_TITLES.some((t) => lowerRole.includes(t) || lowerHeadline.includes(t));
  signals.ownerSeniority = isOwnerRole ? 15 : 0;

  const hasUsLocation = /(us|usa|united states|texas|california|arizona|florida|new york)/.test(lowerLocation);
  signals.usLocation = hasUsLocation ? 10 : 0;

  const networkingMarkers = BNI_MARKERS.some((m) => lowerHeadline.includes(m));
  signals.networkingMarkers = networkingMarkers ? 20 : 0;

  const fitScore = clamp(Object.values(signals).reduce((a, b) => a + b, 0), 0, 100);

  // Leader score weights seniority + networking experience much more heavily.
  const leaderSignals = {
    ownerSeniority: isOwnerRole ? 35 : 0,
    networkingHistory: networkingMarkers ? 35 : 0,
    salesRole: isSalesyRole ? 10 : 0,
    industryFit: signals.industryFit ? 10 : 0,
    usLocation: hasUsLocation ? 10 : 0,
  };
  const leaderScore = clamp(Object.values(leaderSignals).reduce((a, b) => a + b, 0), 0, 100);

  return { fitScore, leaderScore, signals: { ...signals, ...leaderSignals } };
}

export async function ingestProspect(input: ProspectInput): Promise<{
  id: string;
  fitScore: number;
  leaderScore: number;
  status: ProspectStatus;
}> {
  const scoring = scoreProspect(input);
  const groupId = await pickRegionalGroup(input);

  const row = await prisma.linkedInProspect.upsert({
    where: { linkedInUrl: input.linkedInUrl },
    create: {
      fullName: input.fullName,
      headline: input.headline ?? null,
      linkedInUrl: input.linkedInUrl,
      industry: input.industry ?? null,
      jobRole: input.jobRole ?? null,
      location: input.location ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      fitScore: scoring.fitScore,
      leaderScore: scoring.leaderScore,
      signals: scoring.signals as unknown as Prisma.InputJsonValue,
      source: input.source ?? 'manual',
      assignedGroupId: groupId,
      status: 'identified',
    },
    update: {
      fullName: input.fullName,
      headline: input.headline ?? null,
      industry: input.industry ?? null,
      jobRole: input.jobRole ?? null,
      location: input.location ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      fitScore: scoring.fitScore,
      leaderScore: scoring.leaderScore,
      signals: scoring.signals as unknown as Prisma.InputJsonValue,
      assignedGroupId: groupId,
    },
    select: { id: true, fitScore: true, leaderScore: true, status: true },
  });

  return { ...row, status: row.status as ProspectStatus };
}

export async function advanceProspect(id: string, newStatus: ProspectStatus, notes?: string) {
  if (!PROSPECT_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid status ${newStatus}`);
  }
  return prisma.linkedInProspect.update({
    where: { id },
    data: {
      status: newStatus,
      notes: notes ?? undefined,
      lastTouchedAt: new Date(),
    },
  });
}

export interface PipelineSnapshot {
  byStatus: Record<ProspectStatus, number>;
  total: number;
  topByFit: Array<{ id: string; fullName: string; fitScore: number; status: ProspectStatus }>;
  topLeaderCandidates: Array<{ id: string; fullName: string; leaderScore: number; status: ProspectStatus }>;
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const rows = await prisma.linkedInProspect.findMany({
    select: { id: true, fullName: true, fitScore: true, leaderScore: true, status: true },
  });
  const byStatus = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, 0])) as Record<ProspectStatus, number>;
  for (const r of rows) {
    byStatus[r.status as ProspectStatus] = (byStatus[r.status as ProspectStatus] ?? 0) + 1;
  }
  const topByFit = [...rows]
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 10)
    .map((r) => ({ id: r.id, fullName: r.fullName, fitScore: r.fitScore, status: r.status as ProspectStatus }));
  const topLeaderCandidates = [...rows]
    .sort((a, b) => b.leaderScore - a.leaderScore)
    .slice(0, 10)
    .map((r) => ({ id: r.id, fullName: r.fullName, leaderScore: r.leaderScore, status: r.status as ProspectStatus }));
  return { byStatus, total: rows.length, topByFit, topLeaderCandidates };
}

async function pickRegionalGroup(input: ProspectInput): Promise<string | null> {
  if (!input.city && !input.state) return null;
  const where: Prisma.GroupWhereInput = { status: 'active' };
  if (input.city) where.city = input.city;
  if (input.state) where.state = input.state;
  const group = await prisma.group.findFirst({ where, select: { id: true } });
  if (group) return group.id;
  if (input.state) {
    const stateOnly = await prisma.group.findFirst({
      where: { state: input.state, status: 'active' },
      select: { id: true },
    });
    return stateOnly?.id ?? null;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
