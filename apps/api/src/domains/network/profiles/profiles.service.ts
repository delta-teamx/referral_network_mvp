import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText, sanitizeArray } from '../../../utils/sanitize.js';
import { getMemberBadges } from '../referral-tracking/referral-tracking.service.js';
import { activeRewardUserIds } from '../rewards/rewards.service.js';

export interface UpsertProfileInput {
  businessName: string;
  industry: string;
  headline?: string;
  bio?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  website?: string;
  keywords?: string[];
  servicesOffered?: string[];
  yearsInBusiness?: number;
  icpIndustries?: string[];
  icpRoles?: string[];
  icpProblems?: string[];
  icpDealSize?: string;
  canReferIndustries?: string[];
  canReferTypes?: string[];
  city?: string;
  state?: string;
  zipCode?: string;
  serviceArea?: 'local' | 'remote' | 'international';
  serviceRadius?: number;
  openToBarter?: boolean;
  barterOfferings?: string[];
  barterWants?: string[];
  barterNotes?: string;
}

/** Normalize a user-entered website: trim, drop if empty, add https:// if no scheme. */
function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return withScheme.slice(0, 300);
}

export async function upsertMemberProfile(userId: string, input: UpsertProfileInput) {
  const data = {
    businessName: sanitizeText(input.businessName),
    industry: sanitizeText(input.industry),
    headline: input.headline ? sanitizeText(input.headline) || null : null,
    // Only touch the photo when the payload carries it - the onboarding and
    // settings forms don't send photoUrl, and defaulting to null here was
    // silently WIPING an already-uploaded photo on every profile save.
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl || null } : {}),
    // Same guard for LinkedIn: undefined = leave as-is, '' = clear.
    ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl || null } : {}),
    // Business website - same undefined/'' guard.
    ...(input.website !== undefined
      ? { website: normalizeUrl(input.website) }
      : {}),
    bio: input.bio ? sanitizeText(input.bio) || null : null,
    keywords: sanitizeArray((input.keywords ?? []).map((k) => k.toLowerCase())),
    servicesOffered: sanitizeArray(input.servicesOffered ?? []),
    yearsInBusiness: input.yearsInBusiness ?? null,
    icpIndustries: sanitizeArray((input.icpIndustries ?? []).map((s) => s.toLowerCase())),
    icpRoles: sanitizeArray((input.icpRoles ?? []).map((s) => s.toLowerCase())),
    icpProblems: sanitizeArray(input.icpProblems ?? []),
    icpDealSize: input.icpDealSize ? sanitizeText(input.icpDealSize) || null : null,
    canReferIndustries: sanitizeArray((input.canReferIndustries ?? []).map((s) => s.toLowerCase())),
    canReferTypes: sanitizeArray(input.canReferTypes ?? []),
    city: input.city ? sanitizeText(input.city) || null : null,
    state: input.state?.trim().toUpperCase().slice(0, 2) || null,
    zipCode: input.zipCode?.trim() || null,
    serviceArea: input.serviceArea ?? 'local',
    serviceRadius: input.serviceRadius ?? null,
    openToBarter: input.openToBarter ?? false,
    barterOfferings: sanitizeArray(input.barterOfferings ?? []),
    barterWants: sanitizeArray(input.barterWants ?? []),
    barterNotes: input.barterNotes ? sanitizeText(input.barterNotes) || null : null,
  };

  const profile = await prisma.memberProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: { ...data, embeddingUpdatedAt: null },
    select: profileSelect,
  });

  // Merge (union) the step into whatever's already recorded instead of
  // overwriting - the old `set: ['profile_submitted']` wiped every other step a
  // member had completed each time they saved their profile.
  const existingProgress = await prisma.onboardingProgress.findUnique({
    where: { userId },
    select: { completedSteps: true },
  });
  // completedSteps is a Json column - coerce to a string[] before merging.
  const priorSteps = Array.isArray(existingProgress?.completedSteps)
    ? (existingProgress.completedSteps as string[])
    : [];
  const mergedSteps = Array.from(new Set([...priorSteps, 'profile_submitted']));
  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: { userId, completedSteps: ['profile_submitted'], completedAt: new Date() },
    update: {
      completedSteps: mergedSteps,
      completedAt: new Date(),
    },
  });

  await eventBus.publish('onboarding.completed', { userId });
  return profile;
}

export async function getMemberProfile(userId: string) {
  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: profileSelect,
  });
  if (!profile) throw AppError.notFound('Member profile not found');
  return profile;
}

/** The first N (non-admin) accounts are founding members. */
const FOUNDING_MEMBER_LIMIT = 200;

/**
 * createdAt of the Nth member, or null while the community is still smaller
 * than N (then everyone qualifies).
 */
async function foundingCutoffDate(): Promise<Date | null> {
  const nth = await prisma.user.findMany({
    where: { deletedAt: null, role: { not: 'ADMIN' } },
    orderBy: { createdAt: 'asc' },
    skip: FOUNDING_MEMBER_LIMIT - 1,
    take: 1,
    select: { createdAt: true },
  });
  return nth[0]?.createdAt ?? null;
}

function isFounding(createdAt: Date, role: string, cutoff: Date | null): boolean {
  return role !== 'ADMIN' && (cutoff === null || createdAt <= cutoff);
}

export async function getPublicProfile(idOrUserId: string) {
  const profile = await prisma.memberProfile.findFirst({
    where: { OR: [{ id: idOrUserId }, { userId: idOrUserId }] },
    select: {
      ...profileSelect,
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true, role: true },
      },
    },
  });
  if (!profile) throw AppError.notFound('Profile not found');
  const [cutoff, badgeInfo] = await Promise.all([
    foundingCutoffDate(),
    // Live leaderboard badges + perks for THIS member (Connector, Priority
    // matching, Ambassador, ...), earned from the current monthly cycle. This
    // is what makes the leaderboard tags actually show up on the profile.
    getMemberBadges(profile.userId),
  ]);
  return {
    ...profile,
    isFoundingMember: isFounding(profile.user.createdAt, profile.user.role, cutoff),
    badges: badgeInfo.badges,
    priorityMatching: badgeInfo.priorityMatching,
    badgeCycleLabel: badgeInfo.cycleLabel,
    contributionScore: badgeInfo.contributionScore,
    verifiedReferrals: badgeInfo.verifiedReferrals,
  };
}

export async function searchMembers(filters: { q?: string; industry?: string; city?: string; state?: string; groupId?: string; limit?: number }) {
  const limit = Math.min(filters.limit ?? 100, 200);
  // Free-text search matches a PERSON'S NAME as well as their business/profile.
  // Previously we only searched businessName/headline/bio, so looking up a
  // member by their first or last name ("Dawn") returned nothing. We now split
  // the query into words and require every word to match somewhere (name,
  // business, headline, bio or industry), so "dawn", "dawn smith" and "smith"
  // all find the right person.
  const tokens = (filters.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const textFilter =
    tokens.length > 0
      ? {
          AND: tokens.map((token) => ({
            OR: [
              { businessName: { contains: token, mode: 'insensitive' as const } },
              { headline: { contains: token, mode: 'insensitive' as const } },
              { bio: { contains: token, mode: 'insensitive' as const } },
              { industry: { contains: token, mode: 'insensitive' as const } },
              { user: { firstName: { contains: token, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: token, mode: 'insensitive' as const } } },
            ],
          })),
        }
      : {};
  const where: Parameters<typeof prisma.memberProfile.findMany>[0] = {
    where: {
      // Admin accounts are operational, not networking members - never list
      // them in the directory.
      user: { deletedAt: null, role: { not: 'ADMIN' } },
      ...(filters.industry ? { industry: { contains: filters.industry, mode: 'insensitive' } } : {}),
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.state ? { state: filters.state.toUpperCase().slice(0, 2) } : {}),
      ...textFilter,
    },
  };
  let userIds: string[] | undefined;
  if (filters.groupId) {
    const members = await prisma.groupMember.findMany({ where: { groupId: filters.groupId }, select: { userId: true } });
    userIds = members.map((m) => m.userId);
  }
  const [profiles, cutoff] = await Promise.all([
    prisma.memberProfile.findMany({
      ...where,
      ...(userIds ? { where: { ...where.where, userId: { in: userIds } } } : {}),
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        ...profileSelect,
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true, role: true },
        },
      },
    }),
    foundingCutoffDate(),
  ]);
  // Members with an active "featured placement" reward rise to the top of the
  // directory page (and are flagged so the UI can badge them).
  const featured = await activeRewardUserIds('featured');
  return profiles
    .map((p) => ({
      ...p,
      isFoundingMember: isFounding(p.user.createdAt, p.user.role, cutoff),
      isFeatured: featured.has(p.userId),
    }))
    .sort((a, b) => (a.isFeatured === b.isFeatured ? 0 : a.isFeatured ? -1 : 1));
}

export async function setVideoMeta(userId: string, meta: { videoUrl: string; videoKey: string; videoDurationSec?: number }) {
  return prisma.memberProfile.update({
    where: { userId },
    data: { videoUrl: meta.videoUrl, videoKey: meta.videoKey, videoDurationSec: meta.videoDurationSec ?? null, videoProcessed: false },
    select: { id: true, videoUrl: true },
  });
}

export async function setVideoTranscript(userId: string, transcript: string) {
  return prisma.memberProfile.update({
    where: { userId },
    data: { videoTranscript: transcript, videoProcessed: true, embeddingUpdatedAt: null },
    select: { id: true, videoProcessed: true },
  });
}

const profileSelect = {
  id: true, userId: true, businessName: true, industry: true, headline: true, bio: true, photoUrl: true, linkedinUrl: true, website: true,
  keywords: true, servicesOffered: true, yearsInBusiness: true, icpIndustries: true, icpRoles: true,
  icpProblems: true, icpDealSize: true, canReferIndustries: true, canReferTypes: true,
  videoUrl: true, videoDurationSec: true, videoTranscript: true, videoProcessed: true,
  city: true, state: true, zipCode: true, openToBarter: true, barterOfferings: true,
  barterWants: true, barterNotes: true, createdAt: true, updatedAt: true,
} as const;
