import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText, sanitizeArray } from '../../../utils/sanitize.js';

export interface UpsertProfileInput {
  businessName: string;
  industry: string;
  headline?: string;
  bio?: string;
  photoUrl?: string;
  linkedinUrl?: string;
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

  await prisma.onboardingProgress.upsert({
    where: { userId },
    create: { userId, completedSteps: ['profile_submitted'], completedAt: new Date() },
    // The row already exists (created at signup), so the update branch is what
    // actually runs - record the step here too (set, not push, to stay
    // idempotent when a member edits their profile again).
    update: {
      completedSteps: ['profile_submitted'],
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
  const cutoff = await foundingCutoffDate();
  return {
    ...profile,
    isFoundingMember: isFounding(profile.user.createdAt, profile.user.role, cutoff),
  };
}

export async function searchMembers(filters: { q?: string; industry?: string; city?: string; state?: string; groupId?: string; limit?: number }) {
  const limit = Math.min(filters.limit ?? 20, 50);
  const where: Parameters<typeof prisma.memberProfile.findMany>[0] = {
    where: {
      // Admin accounts are operational, not networking members - never list
      // them in the directory.
      user: { deletedAt: null, role: { not: 'ADMIN' } },
      ...(filters.industry ? { industry: { contains: filters.industry, mode: 'insensitive' } } : {}),
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.state ? { state: filters.state.toUpperCase().slice(0, 2) } : {}),
      ...(filters.q ? { OR: [
        { businessName: { contains: filters.q, mode: 'insensitive' } },
        { headline: { contains: filters.q, mode: 'insensitive' } },
        { bio: { contains: filters.q, mode: 'insensitive' } },
      ] } : {}),
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
  return profiles.map((p) => ({
    ...p,
    isFoundingMember: isFounding(p.user.createdAt, p.user.role, cutoff),
  }));
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
  id: true, userId: true, businessName: true, industry: true, headline: true, bio: true, photoUrl: true, linkedinUrl: true,
  keywords: true, servicesOffered: true, yearsInBusiness: true, icpIndustries: true, icpRoles: true,
  icpProblems: true, icpDealSize: true, canReferIndustries: true, canReferTypes: true,
  videoUrl: true, videoDurationSec: true, videoTranscript: true, videoProcessed: true,
  city: true, state: true, zipCode: true, openToBarter: true, barterOfferings: true,
  barterWants: true, barterNotes: true, createdAt: true, updatedAt: true,
} as const;
