import { prisma } from '../../../config/prisma.js';
import { listEngagementForAllMembers } from './engagement.service.js';

/**
 * Feature 4 brief: "Member CRM — records for each member: signup date,
 * payment status, renewal date, engagement score, meeting attendance,
 * referral activity."
 *
 * Joins User + Subscription + engagement signals + intro/meeting counts
 * into a single row per member so admins can spot who's at risk, who's
 * about to renew, and who's the high-value power user.
 */

export interface MemberCrmRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subscriptionTier: string;
  signedUpAt: string;
  lastLoginAt: string | null;
  paymentStatus: 'active' | 'past_due' | 'canceled' | 'none';
  renewsAt: string | null;
  engagementScore: number;
  introsRequested: number;
  introsAccepted: number;
  meetingsAttended: number;
  totalConnections: number;
}

export async function listMemberCrm(opts: { limit?: number } = {}): Promise<MemberCrmRow[]> {
  const limit = opts.limit ?? 200;

  const members = await prisma.user.findMany({
    where: { deletedAt: null, memberProfile: { isNot: null } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      subscriptionTier: true,
      createdAt: true,
      lastLoginAt: true,
      subscription: {
        select: { status: true, currentPeriodEnd: true },
      },
    },
  });
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.id);
  const engagement = await listEngagementForAllMembers();
  const engagementByUser = new Map(engagement.map((e) => [e.userId, e]));

  const connections = await prisma.businessConnection.groupBy({
    by: ['initiatorId', 'targetId'],
    where: {
      status: 'accepted',
      OR: [{ initiatorId: { in: userIds } }, { targetId: { in: userIds } }],
    },
    _count: { _all: true },
  });
  const connectionCount = new Map<string, number>();
  for (const row of connections) {
    for (const uid of [row.initiatorId, row.targetId]) {
      if (userIds.includes(uid)) {
        connectionCount.set(uid, (connectionCount.get(uid) ?? 0) + row._count._all);
      }
    }
  }

  return members.map((m): MemberCrmRow => {
    const eng = engagementByUser.get(m.id);
    return {
      userId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      role: m.role,
      subscriptionTier: m.subscriptionTier,
      signedUpAt: m.createdAt.toISOString(),
      lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
      paymentStatus: derivePaymentStatus(m.subscription?.status),
      renewsAt: m.subscription?.currentPeriodEnd?.toISOString() ?? null,
      engagementScore: eng?.score ?? 0,
      introsRequested: eng?.signals.introsRequested ?? 0,
      introsAccepted: eng?.signals.introsAccepted ?? 0,
      meetingsAttended: eng?.signals.meetingsAttended ?? 0,
      totalConnections: connectionCount.get(m.id) ?? 0,
    };
  });
}

function derivePaymentStatus(s: string | undefined): MemberCrmRow['paymentStatus'] {
  if (!s) return 'none';
  if (s === 'active' || s === 'trialing') return 'active';
  if (s === 'past_due' || s === 'unpaid' || s === 'incomplete') return 'past_due';
  if (s === 'canceled' || s === 'incomplete_expired') return 'canceled';
  return 'none';
}
