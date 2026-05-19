import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma.js';
import { isLlmEnabled, scoreProfilePair, type ProfileSummary } from './llm-scorer.service.js';

/**
 * LLM refinement: walks the user's persisted Introduction suggestions and
 * upgrades each row's score + reason using Claude. Idempotent — running it
 * twice on the same suggestion overwrites the prior LLM result with the new
 * one and leaves `matchFactors.heuristic` intact so the rules signals are
 * still inspectable.
 */

const profileSelect = {
  userId: true,
  businessName: true,
  industry: true,
  headline: true,
  keywords: true,
  servicesOffered: true,
  icpIndustries: true,
  icpRoles: true,
  canReferIndustries: true,
  canReferTypes: true,
  city: true,
  state: true,
  openToBarter: true,
  barterOfferings: true,
  barterWants: true,
} as const;

export interface RefinementResult {
  refined: number;
  skipped: number;
  failed: number;
}

export async function refineSuggestionsForUser(
  userId: string,
  opts: { limit?: number } = {},
): Promise<RefinementResult> {
  if (!isLlmEnabled()) {
    throw new Error('LLM scoring is not configured (ANTHROPIC_API_KEY unset)');
  }

  const myProfileRow = await prisma.memberProfile.findUnique({
    where: { userId },
    select: profileSelect,
  });
  if (!myProfileRow) {
    throw new Error('Member profile not found');
  }

  const suggestions = await prisma.introduction.findMany({
    where: { senderId: userId, status: 'suggested' },
    orderBy: { matchScore: 'desc' },
    take: opts.limit ?? 30,
    select: {
      id: true,
      targetId: true,
      matchFactors: true,
      target: {
        select: {
          firstName: true,
          lastName: true,
          memberProfile: { select: profileSelect },
        },
      },
    },
  });

  const me: ProfileSummary = toSummary(myProfileRow);
  let refined = 0;
  let skipped = 0;
  let failed = 0;

  for (const intro of suggestions) {
    const themProfile = intro.target.memberProfile;
    if (!themProfile) {
      skipped++;
      continue;
    }
    const them: ProfileSummary = toSummary(themProfile, {
      firstName: intro.target.firstName,
      lastName: intro.target.lastName,
    });

    try {
      const result = await scoreProfilePair(me, them);
      if (!result) {
        skipped++;
        continue;
      }

      const heuristicFactors =
        (intro.matchFactors as Record<string, unknown> | null) ?? {};
      const mergedFactors = {
        heuristic: heuristicFactors,
        llm: result.signals,
        tier: result.tier,
      };

      await prisma.introduction.update({
        where: { id: intro.id },
        data: {
          matchScore: result.score,
          reason: result.reason,
          matchFactors: mergedFactors as Prisma.InputJsonValue,
        },
      });
      refined++;
    } catch {
      failed++;
    }
  }

  return { refined, skipped, failed };
}

function toSummary(
  p: {
    userId: string;
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
    openToBarter: boolean;
    barterOfferings: string[];
    barterWants: string[];
  },
  extras?: { firstName?: string; lastName?: string },
): ProfileSummary {
  return {
    userId: p.userId,
    firstName: extras?.firstName,
    lastName: extras?.lastName,
    businessName: p.businessName,
    industry: p.industry,
    headline: p.headline,
    keywords: p.keywords,
    servicesOffered: p.servicesOffered,
    icpIndustries: p.icpIndustries,
    icpRoles: p.icpRoles,
    canReferIndustries: p.canReferIndustries,
    canReferTypes: p.canReferTypes,
    city: p.city,
    state: p.state,
    openToBarter: p.openToBarter,
    barterOfferings: p.barterOfferings,
    barterWants: p.barterWants,
  };
}
