import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Member profile view: everything the viewing member needs to decide whether
 * to request an intro. Combines the target's MemberProfile, the viewer↔target
 * relationship state (Introduction + BusinessConnection), and a 1-hop snapshot
 * of the target's accepted business connections for the "recent connections"
 * panel.
 *
 * The full referral-network graph visualization is deferred — this returns a
 * flat list of the strongest 8 connections by strengthScore.
 */

export interface ConnectionSummary {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  businessName: string | null;
  industry: string | null;
}

export type ViewerRelationship =
  | { kind: 'self' }
  | { kind: 'connected'; acceptedAt: Date | null }
  | { kind: 'pending_outgoing' }
  | { kind: 'pending_incoming' }
  | { kind: 'intro_suggested'; introId: string }
  | { kind: 'intro_requested'; introId: string }
  | { kind: 'none' };

export interface MemberProfileView {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  profile: {
    businessName: string;
    industry: string;
    headline: string | null;
    bio: string | null;
    yearsInBusiness: number | null;
    servicesOffered: string[];
    keywords: string[];
    icpIndustries: string[];
    icpRoles: string[];
    icpProblems: string[];
    canReferIndustries: string[];
    canReferTypes: string[];
    city: string | null;
    state: string | null;
    videoUrl: string | null;
    videoDurationSec: number | null;
  };
  relationship: ViewerRelationship;
  recentConnections: ConnectionSummary[];
  stats: {
    totalConnections: number;
    introsSent: number;
    introsAccepted: number;
  };
}

export async function getMemberProfileForViewing(
  viewerId: string,
  targetUserId: string,
): Promise<MemberProfileView> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      deletedAt: true,
      memberProfile: {
        select: {
          businessName: true,
          industry: true,
          headline: true,
          bio: true,
          yearsInBusiness: true,
          servicesOffered: true,
          keywords: true,
          icpIndustries: true,
          icpRoles: true,
          icpProblems: true,
          canReferIndustries: true,
          canReferTypes: true,
          city: true,
          state: true,
          videoUrl: true,
          videoDurationSec: true,
        },
      },
    },
  });

  if (!target || target.deletedAt) throw AppError.notFound('Member not found');
  if (!target.memberProfile) throw AppError.notFound('Member profile not set up');

  const relationship = await loadRelationship(viewerId, targetUserId);
  const recentConnections = await loadRecentConnections(targetUserId, 8);
  const stats = await loadStats(targetUserId);

  return {
    user: {
      id: target.id,
      firstName: target.firstName,
      lastName: target.lastName,
      avatarUrl: target.avatarUrl,
    },
    profile: target.memberProfile,
    relationship,
    recentConnections,
    stats,
  };
}

async function loadRelationship(
  viewerId: string,
  targetUserId: string,
): Promise<ViewerRelationship> {
  if (viewerId === targetUserId) return { kind: 'self' };

  const connection = await prisma.businessConnection.findFirst({
    where: {
      OR: [
        { initiatorId: viewerId, targetId: targetUserId },
        { initiatorId: targetUserId, targetId: viewerId },
      ],
    },
    select: { initiatorId: true, status: true, acceptedAt: true },
  });

  if (connection) {
    if (connection.status === 'accepted') {
      return { kind: 'connected', acceptedAt: connection.acceptedAt };
    }
    if (connection.status === 'pending') {
      return connection.initiatorId === viewerId
        ? { kind: 'pending_outgoing' }
        : { kind: 'pending_incoming' };
    }
  }

  const intro = await prisma.introduction.findFirst({
    where: {
      senderId: viewerId,
      targetId: targetUserId,
      status: { in: ['suggested', 'requested'] },
    },
    select: { id: true, status: true },
  });

  if (intro) {
    return intro.status === 'requested'
      ? { kind: 'intro_requested', introId: intro.id }
      : { kind: 'intro_suggested', introId: intro.id };
  }

  return { kind: 'none' };
}

async function loadRecentConnections(
  userId: string,
  limit: number,
): Promise<ConnectionSummary[]> {
  const rows = await prisma.businessConnection.findMany({
    where: {
      status: 'accepted',
      OR: [{ initiatorId: userId }, { targetId: userId }],
    },
    orderBy: { strengthScore: 'desc' },
    take: limit,
    select: {
      initiatorId: true,
      targetId: true,
      initiator: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          memberProfile: { select: { businessName: true, industry: true } },
        },
      },
      target: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          memberProfile: { select: { businessName: true, industry: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const other = row.initiatorId === userId ? row.target : row.initiator;
    return {
      userId: other.id,
      firstName: other.firstName,
      lastName: other.lastName,
      avatarUrl: other.avatarUrl,
      businessName: other.memberProfile?.businessName ?? null,
      industry: other.memberProfile?.industry ?? null,
    };
  });
}

async function loadStats(userId: string) {
  const [totalConnections, introsSent, introsAccepted] = await Promise.all([
    prisma.businessConnection.count({
      where: {
        status: 'accepted',
        OR: [{ initiatorId: userId }, { targetId: userId }],
      },
    }),
    prisma.introduction.count({
      where: { senderId: userId, status: { in: ['requested', 'accepted', 'completed'] } },
    }),
    prisma.introduction.count({
      where: {
        OR: [{ senderId: userId }, { targetId: userId }],
        status: { in: ['accepted', 'completed'] },
      },
    }),
  ]);

  return { totalConnections, introsSent, introsAccepted };
}
