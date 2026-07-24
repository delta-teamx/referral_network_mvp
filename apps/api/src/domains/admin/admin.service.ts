import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { eventBus } from '../core/events/index.js';
import { signAccessToken } from '../../utils/tokens.js';
import { toAuthenticatedUserDto } from '../core/users/users.service.js';

/**
 * Admin operations. Thin wrapper over existing services - admins moderate,
 * they don't get to bypass core domain logic. All methods take an
 * `adminUserId` for the audit log; every mutation publishes a DomainEvent.
 */

export async function adminOverview() {
  const [users, listings, leads, referrals, groups] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.listing.count({ where: { deletedAt: null } }),
    prisma.consumerLead.count(),
    prisma.referral.count(),
    prisma.group.count({ where: { status: 'active' } }),
  ]);

  const tierBreakdown = await prisma.user.groupBy({
    by: ['subscriptionTier'],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const pendingListings = await prisma.listing.count({
    where: { status: 'PENDING_REVIEW', deletedAt: null },
  });

  return {
    counts: { users, listings, leads, referrals, groups, pendingListings },
    tierBreakdown: Object.fromEntries(
      tierBreakdown.map((r) => [r.subscriptionTier, r._count._all]),
    ) as Record<string, number>,
  };
}

export async function listAllUsers(page = 1, limit = 25, q?: string) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { listings: true, sentReferrals: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page, limit };
}

export async function setUserRole(
  adminId: string,
  userId: string,
  role: 'CONSUMER' | 'BUSINESS_OWNER' | 'GROUP_LEADER' | 'CITY_CAPTAIN' | 'ADMIN',
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, role: true, email: true },
  });
  await eventBus.publish('admin.user_role_changed', {
    adminId,
    userId,
    role,
  });
  return updated;
}

export async function suspendUser(adminId: string, userId: string, reason: string) {
  const existing = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw AppError.notFound('User not found');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
    select: { id: true, email: true },
  });
  await eventBus.publish('admin.user_suspended', {
    adminId,
    userId,
    reason,
  });
  return updated;
}

/**
 * HARD delete: remove the user and every trace of their activity - messages
 * (whole threads, both sides), intros, connections, contracts, referrals,
 * pipeline cards, bookings, listings + reviews/leads on them, group posts,
 * support tickets, notifications, subscription, profile. Built for wiping
 * test accounts; irreversible, admin-only, and never allowed on admins.
 */
export async function hardDeleteUser(adminId: string, userId: string) {
  if (adminId === userId) throw AppError.badRequest('You cannot delete your own account.');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) throw AppError.notFound('User not found');
  if (user.role === 'ADMIN') {
    throw AppError.badRequest('Admin accounts cannot be hard-deleted from the console.');
  }

  // Whole conversations the user is part of (removes both sides of test chats).
  const convoIds = (
    await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    })
  ).map((c) => c.conversationId);

  // Their listings and everything hanging off them.
  const listingIds = (
    await prisma.listing.findMany({ where: { userId }, select: { id: true } })
  ).map((l) => l.id);

  await prisma.$transaction([
    // Messaging
    prisma.message.deleteMany({
      where: { OR: [{ senderId: userId }, { conversationId: { in: convoIds } }] },
    }),
    prisma.conversationParticipant.deleteMany({
      where: { conversationId: { in: convoIds } },
    }),
    prisma.conversation.deleteMany({ where: { id: { in: convoIds } } }),
    // Matching + network
    prisma.introduction.deleteMany({
      where: { OR: [{ senderId: userId }, { targetId: userId }] },
    }),
    prisma.businessConnection.deleteMany({
      where: { OR: [{ initiatorId: userId }, { targetId: userId }] },
    }),
    prisma.businessInvitation.deleteMany({
      where: { OR: [{ senderId: userId }, { recipientUserId: userId }] },
    }),
    prisma.contract.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    }),
    prisma.referral.deleteMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }, { listingId: { in: listingIds } }],
      },
    }),
    prisma.referralTracking.deleteMany({
      where: { OR: [{ referrerUserId: userId }, { inviteeUserId: userId }] },
    }),
    prisma.pipelineCard.deleteMany({
      where: { OR: [{ ownerId: userId }, { contactUserId: userId }] },
    }),
    // Bookings, events, pods
    prisma.bookingCall.deleteMany({
      where: { OR: [{ hostId: userId }, { guestId: userId }] },
    }),
    prisma.availability.deleteMany({ where: { userId } }),
    prisma.eventRegistration.deleteMany({ where: { userId } }),
    prisma.podFeedback.deleteMany({ where: { userId } }),
    prisma.podMember.deleteMany({ where: { userId } }),
    prisma.meetingHistory.deleteMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
    }),
    // Groups
    prisma.groupMessage.deleteMany({ where: { senderId: userId } }),
    prisma.groupMember.deleteMany({ where: { userId } }),
    // Directory
    prisma.review.deleteMany({
      where: { OR: [{ userId }, { listingId: { in: listingIds } }] },
    }),
    prisma.consumerLead.deleteMany({
      where: { OR: [{ consumerId: userId }, { listingId: { in: listingIds } }] },
    }),
    prisma.favorite.deleteMany({
      where: { OR: [{ userId }, { listingId: { in: listingIds } }] },
    }),
    prisma.pageView.deleteMany({ where: { listingId: { in: listingIds } } }),
    prisma.listingPhoto.deleteMany({ where: { listingId: { in: listingIds } } }),
    prisma.listingTag.deleteMany({ where: { listingId: { in: listingIds } } }),
    prisma.listing.deleteMany({ where: { id: { in: listingIds } } }),
    // Account
    prisma.supportTicket.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.oAuthAccount.deleteMany({ where: { userId } }),
    prisma.onboardingProgress.deleteMany({ where: { userId } }),
    prisma.memberProfile.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await eventBus.publish('admin.user_suspended', {
    adminId,
    userId,
    reason: `hard_deleted:${user.email}`,
  });
  return { deleted: user.email };
}

export async function impersonateUser(adminId: string, targetUserId: string) {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
  });
  if (!target) throw AppError.notFound('User not found');

  const token = signAccessToken({
    sub: target.id,
    email: target.email,
    role: target.role,
    tier: target.subscriptionTier,
    ev: target.emailVerified,
  });

  await eventBus.publish('admin.user_impersonated', {
    adminId,
    targetUserId,
  });

  return {
    user: await toAuthenticatedUserDto(target),
    accessToken: token,
    expiresIn: 3600,
  };
}

export async function listPendingListings() {
  return prisma.listing.findMany({
    where: { status: 'PENDING_REVIEW', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      createdAt: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
      category: { select: { name: true, slug: true } },
    },
  });
}

export async function approveListing(adminId: string, listingId: string) {
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'ACTIVE' },
    select: { id: true, slug: true, status: true },
  });
  await eventBus.publish('admin.listing_approved', {
    adminId,
    listingId,
  });
  return updated;
}

export async function rejectListing(adminId: string, listingId: string, reason: string) {
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status: 'ARCHIVED' },
    select: { id: true, slug: true, status: true },
  });
  await eventBus.publish('admin.listing_rejected', {
    adminId,
    listingId,
    reason,
  });
  return updated;
}

export async function featureListing(adminId: string, listingId: string, featured: boolean) {
  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { isFeatured: featured },
    select: { id: true, slug: true, isFeatured: true },
  });
  await eventBus.publish('admin.listing_featured', {
    adminId,
    listingId,
    featured,
  });
  return updated;
}

export async function listAllListings(page = 1, limit = 25, q?: string) {
  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { city: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        state: true,
        status: true,
        isVerified: true,
        isFeatured: true,
        avgRating: true,
        reviewCount: true,
        trustScore: true,
        createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);
  return { listings, total, page, limit };
}

export async function listAllGroups() {
  return prisma.group.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      status: true,
      maxMembers: true,
      _count: { select: { members: true } },
    },
  });
}

export async function archiveGroup(adminId: string, groupId: string) {
  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { status: 'archived' },
    select: { id: true, status: true },
  });
  await eventBus.publish('admin.group_archived', {
    adminId,
    groupId,
  });
  return updated;
}
