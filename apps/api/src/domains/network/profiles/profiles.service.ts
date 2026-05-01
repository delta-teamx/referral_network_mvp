import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText, sanitizeArray } from '../../../utils/sanitize.js';

/**
 * Member profiles — the "referral intelligence" layer that powers AI matching.
 *
 * Each user gets one MemberProfile (upserted on intake completion). The
 * profile stores:
 *   - Business identity (name, industry, headline, services, keywords)
 *   - ICP: "who I WANT to meet" (industries, roles, problems they solve)
 *   - Referral cap: "who I CAN REFER" (industries, client types)
 *   - Video intro metadata (URL, transcript)
 *   - AI embedding (written by the matching engine after profile change)
 */

export interface UpsertProfileInput {
  businessName: string;
  industry: string;
  headline?: string;
  bio?: string;
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

export async function getPublicProfile(idOrUserId: string) {
  // Accept either a MemberProfile.id or a User.id — lets the frontend link
  // to profiles without needing the profile ID.
  const profile = await prisma.memberProfile.findFirst({
    where: {
      OR: [{ id: idOrUserId }, { userId: idOrUserId }],
    },
    select: {
      ...profileSelect,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      },
    },
  });
  if (!profile) throw AppError.notFound('Profile not found');
  return profile;
}

export async function searchMembers(filters: {
  q?: string;
  industry?: string;
  city?: string;
  state?: string;
  groupId?: string;
  limit?: number;
}) {
  const limit = Math.min(filters.limit ?? 20, 50);
  const where: Parameters<typeof prisma.memberProfile.findMany>[0] = {
    where: {
      ...(filters.industry
        ? { industry: { contains: filters.industry, mode: 'insensitive' } }
        : {}),
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.state ? { state: filters.state.toUpperCase().slice(0, 2) } : {}),
      ...(filters.q
        ? {
            OR: [
              { businessName: { contains: filters.q, mode: 'insensitive' } },
              { headline: { contains: filters.q, mode: 'insensitive' } },
              { bio: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
  };

  let userIds: string[] | undefined;
  if (filters.groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: filters.groupId },
      select: { userId: true },
    });
    userIds = members.map((m) => m.userId);
  }

  return prisma.memberProfile.findMany({
    ...where,
    ...(userIds ? { where: { ...where.where, userId: { in: userIds } } } : {}),
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      ...profileSelect,
      user: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
    },
  });
}

export async function setVideoMeta(
  userId: string,
  meta: { videoUrl: string; videoKey: string; videoDurationSec?: number },
) {
  return prisma.memberProfile.update({
    where: { userId },
    data: {
      videoUrl: meta.videoUrl,
      videoKey: meta.videoKey,
      videoDurationSec: meta.videoDurationSec ?? null,
      videoProcessed: false,
    },
    select: { id: true, videoUrl: true },
  });
}

export async function setVideoTranscript(userId: string, transcript: string) {
  return prisma.memberProfile.update({
    where: { userId },
    data: {
      videoTranscript: transcript,
      videoProcessed: true,
      embeddingUpdatedAt: null,
    },
    select: { id: true, videoProcessed: true },
  });
}

const profileSelect = {
  id: true,
  userId: true,
  businessName: true,
  industry: true,
  headline: true,
  bio: true,
  keywords: true,
  servicesOffered: true,
  yearsInBusiness: true,
  icpIndustries: true,
  icpRoles: true,
  icpProblems: true,
  icpDealSize: true,
  canReferIndustries: true,
  canReferTypes: true,
  videoUrl: true,
  videoDurationSec: true,
  videoTranscript: true,
  videoProcessed: true,
  city: true,
  state: true,
  zipCode: true,
  openToBarter: true,
  barterOfferings: true,
  barterWants: true,
  barterNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;
