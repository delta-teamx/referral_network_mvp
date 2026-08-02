import { randomUUID } from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { TIERS, type Tier } from '../../billing/billing.tiers.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { createNotification } from '../../core/notifications/notifications.service.js';

const APP_URL = 'https://dashboard.referralnova.com';

/**
 * Groups - BNI-style local networking circles. A group is public-discoverable
 * (by city) and has a fixed-size roster. One LEADER + 0..N CO_LEADERs run it;
 * MEMBERs attend meetings and send referrals inside the group.
 *
 * Created via `createGroup` (GROUP_LEADER role required in routes layer).
 * Membership is open via `joinGroup` if `isPublic=true` and capacity isn't
 * exceeded; private groups accept members only via `addMember` by a leader.
 */

export type GroupRole = 'MEMBER' | 'LEADER' | 'CO_LEADER';

export interface GroupListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  meetingSchedule: string | null;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
  joinPolicy: string;
  lockedInterior: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
}

const groupListSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  city: true,
  state: true,
  meetingSchedule: true,
  maxMembers: true,
  isPublic: true,
  joinPolicy: true,
  lockedInterior: true,
  logoUrl: true,
  primaryColor: true,
  _count: { select: { members: true } },
} as const;

function toListItem(row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  meetingSchedule: string | null;
  maxMembers: number;
  isPublic: boolean;
  joinPolicy: string;
  lockedInterior: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  _count: { members: number };
}): GroupListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    city: row.city,
    state: row.state,
    meetingSchedule: row.meetingSchedule,
    memberCount: row._count.members,
    maxMembers: row.maxMembers,
    isPublic: row.isPublic,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    joinPolicy: row.joinPolicy,
    lockedInterior: row.lockedInterior,
  };
}

export interface CreateGroupInput {
  creatorId: string;
  name: string;
  description?: string;
  city: string;
  state: string;
  meetingSchedule?: string;
  meetingUrl?: string;
  maxMembers?: number;
  isPublic?: boolean;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || 'group';
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.group.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

export async function createGroup(input: CreateGroupInput): Promise<GroupListItem> {
  const slug = await uniqueSlug(input.name);
  const group = await prisma.group.create({
    data: {
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim().toUpperCase().slice(0, 2),
      meetingSchedule: input.meetingSchedule?.trim() || null,
      meetingUrl: input.meetingUrl?.trim() || null,
      maxMembers: input.maxMembers ?? 30,
      isPublic: input.isPublic ?? true,
      members: {
        create: { userId: input.creatorId, role: 'LEADER' },
      },
    },
    select: groupListSelect,
  });

  await eventBus.publish('group.created', {
    groupId: group.id,
    creatorId: input.creatorId,
  });

  return toListItem(group);
}

export interface ListGroupsFilters {
  city?: string;
  state?: string;
  q?: string;
  limit?: number;
}

export async function listGroups(filters: ListGroupsFilters = {}): Promise<GroupListItem[]> {
  const rows = await prisma.group.findMany({
    where: {
      status: 'active',
      isPublic: true,
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.state ? { state: filters.state.toUpperCase().slice(0, 2) } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.limit ?? 50, 100),
    select: groupListSelect,
  });
  return rows.map(toListItem);
}

export async function getGroupBySlug(slug: string, viewerId?: string) {
  const group = await prisma.group.findFirst({
    where: { slug, status: 'active' },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        select: {
          id: true,
          role: true,
          joinedAt: true,
          // NOTE: no email here. This is served from an UNAUTHENTICATED
          // by-slug route, so member emails must never be in the payload.
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
      events: {
        where: { date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 5,
      },
      _count: { select: { members: true } },
    },
  });
  if (!group) throw AppError.notFound('Group not found');

  const viewerMembership = viewerId ? group.members.find((m) => m.user.id === viewerId) : null;
  const viewerRole = (viewerMembership?.role ?? null) as GroupRole | null;
  const isMember = viewerMembership != null;

  // Closed group, viewer not inside: return the visible shell only. The
  // interior (roster, events, messages) is locked - the UI shows a "request to
  // join" or "you have an invite" prompt instead.
  if (group.lockedInterior && !isMember) {
    const memberCount = group._count.members;
    let pendingRequest = false;
    if (viewerId) {
      const req = await prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: viewerId } },
        select: { status: true },
      });
      pendingRequest = req?.status === 'pending';
    }
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      city: group.city,
      state: group.state,
      logoUrl: group.logoUrl,
      primaryColor: group.primaryColor,
      isPublic: group.isPublic,
      status: group.status,
      joinPolicy: group.joinPolicy,
      lockedInterior: true,
      locked: true as const,
      memberCount,
      members: [],
      events: [],
      viewerRole,
      pendingRequest,
      _count: group._count,
    };
  }

  // Full interior for members (and any open, non-locked group). Whitelist the
  // fields the client needs - this route is public, so internal columns
  // (stripeAccountId, billing config, customDomain, meetingUrl, ...) must not
  // ride along on a `...group` spread.
  let pendingRequest = false;
  if (!isMember && viewerId) {
    const req = await prisma.groupJoinRequest.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: viewerId } },
      select: { status: true },
    });
    pendingRequest = req?.status === 'pending';
  }
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    description: group.description,
    city: group.city,
    state: group.state,
    meetingSchedule: group.meetingSchedule,
    maxMembers: group.maxMembers,
    isPublic: group.isPublic,
    status: group.status,
    logoUrl: group.logoUrl,
    primaryColor: group.primaryColor,
    joinPolicy: group.joinPolicy,
    lockedInterior: group.lockedInterior,
    locked: false as const,
    members: group.members,
    events: group.events,
    memberCount: group._count.members,
    pendingRequest,
    viewerRole,
    _count: group._count,
  };
}

export async function joinGroup(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, status: 'active' },
    select: { id: true, isPublic: true, maxMembers: true, joinPolicy: true },
  });
  if (!group) throw AppError.notFound('Group not found');
  if (group.joinPolicy === 'request') {
    throw AppError.badRequest('This group requires approval. Submit a request to join.');
  }
  if (group.joinPolicy === 'invite' || !group.isPublic) {
    throw AppError.badRequest('This group is invite-only. Ask a leader to add you.');
  }

  // Serialize concurrent joins for THIS group with a transaction-scoped
  // advisory lock, so the capacity count-then-insert is atomic and the roster
  // can't be pushed over maxMembers by simultaneous requests.
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group:${groupId}`}))`;

    const existing = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });
    if (existing) return { alreadyMember: true as const };

    const count = await tx.groupMember.count({ where: { groupId } });
    if (count >= group.maxMembers) {
      throw AppError.badRequest('This group is at capacity.');
    }

    // Enforce the joiner's plan cap on how many groups they can belong to.
    const joiner = await tx.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });
    const caps = TIERS[(joiner?.subscriptionTier ?? 'FREE') as Tier];
    const myGroups = await tx.groupMember.count({ where: { userId } });
    if (myGroups >= caps.maxGroupMemberships) {
      throw AppError.forbidden(
        `Your ${caps.name} plan allows joining ${caps.maxGroupMemberships} groups. Upgrade to join more.`,
      );
    }

    await tx.groupMember.create({ data: { groupId, userId, role: 'MEMBER' } });
    return { alreadyMember: false as const };
  });

  if (!result.alreadyMember) {
    await eventBus.publish('group.member_joined', { groupId, userId });
  }
  return result;
}

export async function leaveGroup(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true, role: true },
  });
  if (!member) throw AppError.notFound('Not a member');
  if (member.role === 'LEADER') {
    throw AppError.badRequest(
      'Leaders cannot leave. Promote a co-leader first or archive the group.',
    );
  }
  await prisma.groupMember.delete({ where: { id: member.id } });
  return { ok: true };
}

export async function listMyGroups(userId: string): Promise<
  (GroupListItem & { role: GroupRole })[]
> {
  const rows = await prisma.groupMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'desc' },
    select: {
      role: true,
      group: { select: groupListSelect },
    },
  });
  return rows.map((r) => ({ ...toListItem(r.group), role: r.role as GroupRole }));
}

// ---- Group chat ------------------------------------------------------------

const groupMessageSelect = {
  id: true,
  text: true,
  createdAt: true,
  sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

async function assertGroupMember(groupId: string, userId: string): Promise<void> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (!member) throw AppError.forbidden('Join this group to see and post in its chat.');
}

export async function listGroupMessages(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);
  // Newest 200, returned chronologically - see listMessages: asc + take would
  // strand the view on the oldest messages once the group passed 200.
  return (
    await prisma.groupMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: groupMessageSelect,
    })
  ).reverse();
}

export async function postGroupMessage(groupId: string, userId: string, text: string) {
  await assertGroupMember(groupId, userId);
  const clean = sanitizeText(text).slice(0, 2000);
  if (!clean) throw AppError.badRequest('Message cannot be empty.');
  return prisma.groupMessage.create({
    data: { groupId, senderId: userId, text: clean },
    select: groupMessageSelect,
  });
}

export interface WhitelabelSettings {
  logoUrl?: string | null;
  primaryColor?: string | null;
  welcomeMessage?: string | null;
  billingModel?: 'platform' | 'per_seat' | 'per_group';
  seatPriceCents?: number | null;
  groupPriceCents?: number | null;
}

export async function updateGroupSettings(
  groupId: string,
  userId: string,
  settings: WhitelabelSettings,
) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  if (!member || (member.role !== 'LEADER' && member.role !== 'CO_LEADER')) {
    throw AppError.forbidden('Only group leaders can update settings.');
  }
  return prisma.group.update({
    where: { id: groupId },
    data: {
      ...(settings.logoUrl !== undefined ? { logoUrl: settings.logoUrl } : {}),
      ...(settings.primaryColor !== undefined ? { primaryColor: settings.primaryColor } : {}),
      ...(settings.welcomeMessage !== undefined ? { welcomeMessage: settings.welcomeMessage } : {}),
      ...(settings.billingModel !== undefined ? { billingModel: settings.billingModel } : {}),
      ...(settings.seatPriceCents !== undefined ? { seatPriceCents: settings.seatPriceCents } : {}),
      ...(settings.groupPriceCents !== undefined ? { groupPriceCents: settings.groupPriceCents } : {}),
    },
    select: groupListSelect,
  });
}

// ---- Closed-group access: leaders, invite links, join requests --------------

/** Assert the user is a LEADER or CO_LEADER of the group; returns their role. */
async function assertGroupAdmin(groupId: string, userId: string): Promise<GroupRole> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  if (!member || (member.role !== 'LEADER' && member.role !== 'CO_LEADER')) {
    throw AppError.forbidden('Only group leaders can do this.');
  }
  return member.role as GroupRole;
}

/**
 * Mint a fresh, time-boxed shared invite link (default 48h). Only one link is
 * active at a time - minting a new one deactivates any prior active links.
 * Anyone who joins through it before it expires is auto-added and, when
 * grantsPremium is set, upgraded to lifetime Premium.
 */
export async function mintInviteLink(
  groupId: string,
  userId: string,
  opts: { hours?: number; grantsPremium?: boolean } = {},
) {
  await assertGroupAdmin(groupId, userId);
  const hours = Math.max(1, Math.min(720, Math.round(opts.hours ?? 48)));
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const token = randomUUID().replace(/-/g, '');

  const link = await prisma.$transaction(async (tx) => {
    await tx.groupInviteLink.updateMany({
      where: { groupId, active: true },
      data: { active: false },
    });
    return tx.groupInviteLink.create({
      data: {
        groupId,
        token,
        createdById: userId,
        grantsPremium: opts.grantsPremium ?? true,
        expiresAt,
      },
    });
  });
  return { ...link, url: `${APP_URL}/join-group/${link.token}` };
}

/** The current active, unexpired invite link for a group, if any. */
export async function getActiveInviteLink(groupId: string, userId: string) {
  await assertGroupAdmin(groupId, userId);
  const link = await prisma.groupInviteLink.findFirst({
    where: { groupId, active: true, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return link ? { ...link, url: `${APP_URL}/join-group/${link.token}` } : null;
}

/** Expire (deactivate) the group's active invite link early. */
export async function revokeInviteLink(groupId: string, userId: string) {
  await assertGroupAdmin(groupId, userId);
  await prisma.groupInviteLink.updateMany({
    where: { groupId, active: true },
    data: { active: false },
  });
  return { ok: true };
}

/**
 * Join a group through a shared invite link. Validates the link is active and
 * within its window, adds the caller (idempotent), grants lifetime Premium when
 * the link is configured to, and returns the group summary.
 */
export async function joinViaInviteLink(token: string, userId: string) {
  const link = await prisma.groupInviteLink.findUnique({ where: { token } });
  if (!link || !link.active) throw AppError.badRequest('This invite link is no longer active.');
  if (link.expiresAt.getTime() <= Date.now()) {
    throw AppError.badRequest('This invite link has expired.');
  }
  if (link.maxUses != null && link.uses >= link.maxUses) {
    throw AppError.badRequest('This invite link has reached its limit.');
  }

  const group = await prisma.group.findFirst({
    where: { id: link.groupId, status: 'active' },
    select: { id: true, name: true, slug: true, maxMembers: true },
  });
  if (!group) throw AppError.notFound('Group not found');

  const alreadyMember = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group:${group.id}`}))`;
    const existing = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
      select: { id: true },
    });
    if (existing) return true;

    // Re-read the link under the lock so a capped link can't be pushed past
    // maxUses by concurrent joins (the pre-transaction read is only a fast fail).
    const fresh = await tx.groupInviteLink.findUnique({
      where: { id: link.id },
      select: { active: true, expiresAt: true, uses: true, maxUses: true },
    });
    if (!fresh || !fresh.active || fresh.expiresAt.getTime() <= Date.now()) {
      throw AppError.badRequest('This invite link is no longer active.');
    }
    if (fresh.maxUses != null && fresh.uses >= fresh.maxUses) {
      throw AppError.badRequest('This invite link has reached its limit.');
    }

    const count = await tx.groupMember.count({ where: { groupId: group.id } });
    if (count >= group.maxMembers) throw AppError.badRequest('This group is at capacity.');

    await tx.groupMember.create({ data: { groupId: group.id, userId, role: 'MEMBER' } });
    await tx.groupInviteLink.update({
      where: { id: link.id },
      data: { uses: { increment: 1 } },
    });
    return false;
  });

  // Grant lifetime Premium to launch-link joiners (idempotent, best-effort).
  let premiumGranted = false;
  if (link.grantsPremium && !alreadyMember) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, email: true, firstName: true },
    });
    if (user && user.subscriptionTier !== 'PREMIUM') {
      // Do NOT bump tokenVersion here: that would revoke the session and log
      // the user out on the join-success screen. The new tier flows into their
      // JWT on the next access-token refresh (matches the rewards grant).
      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: 'PREMIUM' },
      });
      premiumGranted = true;
    }
    if (user?.email) {
      void sendEmail({
        to: user.email,
        template: 'group_invite_welcome',
        data: {
          firstName: user.firstName,
          groupName: group.name,
          premium: premiumGranted,
          groupUrl: `${APP_URL}/dashboard/groups?slug=${group.slug}`,
        },
      }).catch(() => undefined);
    }
  }

  if (!alreadyMember) {
    await eventBus.publish('group.member_joined', { groupId: group.id, userId });
  }
  return { group, alreadyMember, premiumGranted };
}

/**
 * Submit a request to join a closed group. Creates a pending request (idempotent
 * per user+group) and emails the group's leaders so they can approve it.
 */
export async function requestToJoin(groupId: string, userId: string, message?: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, status: 'active' },
    select: { id: true, name: true, slug: true, joinPolicy: true, lockedInterior: true },
  });
  if (!group) throw AppError.notFound('Group not found');
  // Only request-based / closed groups take join requests. An open group is
  // joined directly (and 'invite' groups are link-only), so reject here rather
  // than spamming leaders with requests they can't act on.
  if (group.joinPolicy !== 'request' && !group.lockedInterior) {
    throw AppError.badRequest('This group does not accept join requests.');
  }

  const existingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (existingMember) throw AppError.badRequest('You are already a member of this group.');

  const note = message ? sanitizeText(message).slice(0, 500) : null;

  // Upsert so a repeat submit refreshes a pending/declined request rather than
  // colliding on the unique (groupId, userId) index.
  const request = await prisma.groupJoinRequest.upsert({
    where: { groupId_userId: { groupId, userId } },
    create: { groupId, userId, message: note, status: 'pending' },
    update: { status: 'pending', message: note, decidedById: null, decidedAt: null },
  });

  // Notify leaders in-app + by email (best-effort).
  void (async () => {
    const [applicant, leaders] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
      prisma.groupMember.findMany({
        where: { groupId, role: { in: ['LEADER', 'CO_LEADER'] } },
        select: { user: { select: { id: true, email: true, firstName: true } } },
      }),
    ]);
    const applicantName = `${applicant?.firstName ?? ''} ${applicant?.lastName ?? ''}`.trim() || 'A member';
    const reviewUrl = `${APP_URL}/dashboard/groups?slug=${group.slug}&view=manage`;
    for (const l of leaders) {
      void createNotification({
        userId: l.user.id,
        type: 'group_join_request',
        title: `${applicantName} asked to join ${group.name}`,
        body: note || 'Review the request in the group manager.',
        data: { groupId, requestId: request.id },
      }).catch(() => undefined);
      if (l.user.email) {
        void sendEmail({
          to: l.user.email,
          template: 'group_join_request',
          data: {
            firstName: l.user.firstName,
            applicantName,
            groupName: group.name,
            note: note ?? '',
            reviewUrl,
          },
        }).catch(() => undefined);
      }
    }
  })().catch(() => undefined);

  return request;
}

/** Pending join requests for a group (leaders only). */
export async function listJoinRequests(groupId: string, userId: string) {
  await assertGroupAdmin(groupId, userId);
  return prisma.groupJoinRequest.findMany({
    where: { groupId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      message: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          memberProfile: { select: { businessName: true, industry: true, city: true, state: true } },
        },
      },
    },
  });
}

/** Approve or decline a pending join request (leaders only). */
export async function decideJoinRequest(
  requestId: string,
  userId: string,
  decision: 'approve' | 'decline',
) {
  const request = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      groupId: true,
      userId: true,
      status: true,
      group: { select: { name: true, slug: true, maxMembers: true } },
    },
  });
  if (!request) throw AppError.notFound('Request not found');
  await assertGroupAdmin(request.groupId, userId);
  if (request.status !== 'pending') {
    throw AppError.badRequest('This request has already been handled.');
  }

  if (decision === 'decline') {
    await prisma.groupJoinRequest.update({
      where: { id: request.id },
      data: { status: 'declined', decidedById: userId, decidedAt: new Date() },
    });
    return { ok: true, status: 'declined' as const };
  }

  // Approve: add as a member (capacity-checked) and mark the request.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`group:${request.groupId}`}))`;
    const existing = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId: request.groupId, userId: request.userId } },
      select: { id: true },
    });
    if (!existing) {
      const count = await tx.groupMember.count({ where: { groupId: request.groupId } });
      if (count >= request.group.maxMembers) {
        throw AppError.badRequest('This group is at capacity.');
      }
      await tx.groupMember.create({
        data: { groupId: request.groupId, userId: request.userId, role: 'MEMBER' },
      });
    }
    await tx.groupJoinRequest.update({
      where: { id: request.id },
      data: { status: 'approved', decidedById: userId, decidedAt: new Date() },
    });
  });

  await eventBus.publish('group.member_joined', {
    groupId: request.groupId,
    userId: request.userId,
  });

  // Tell the approved member they're in (bell + email, best-effort).
  void (async () => {
    const member = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { email: true, firstName: true },
    });
    void createNotification({
      userId: request.userId,
      type: 'group_request_approved',
      title: `You're in - welcome to ${request.group.name} 🎉`,
      body: 'Your request was approved. Open the group to get started.',
      data: { groupId: request.groupId },
    }).catch(() => undefined);
    if (member?.email) {
      void sendEmail({
        to: member.email,
        template: 'group_request_approved',
        data: {
          firstName: member.firstName,
          groupName: request.group.name,
          groupUrl: `${APP_URL}/dashboard/groups?slug=${request.group.slug}`,
        },
      }).catch(() => undefined);
    }
  })().catch(() => undefined);

  return { ok: true, status: 'approved' as const };
}

// ---- NRG partnership group seed ---------------------------------------------

/** Slug of the official NRG group. */
export const NRG_SLUG = 'nrg';
/** Named NRG group leaders, wired as members on boot when their accounts exist. */
const NRG_LEADERS: Array<{ email: string; role: 'LEADER' | 'CO_LEADER' }> = [
  { email: 'mike@networkreferralgroup.com', role: 'LEADER' },
  { email: 'lori@lorilandin.com', role: 'CO_LEADER' },
];
const ROUL_SUPPORT_EMAIL = 'roul-support@referralnova.com';

/**
 * Ensure the official NRG group exists and its admins are wired up. Idempotent
 * and safe to run on every boot:
 *  - creates the NRG group (closed / request-to-join) once, never overwriting
 *    later admin edits to its name, branding or settings;
 *  - adds the named NRG leaders (Mike, Lori) as they sign up;
 *  - adds every platform admin as a CO_LEADER so the team can test and manage.
 */
export async function seedNrgGroup(): Promise<void> {
  try {
    const group = await prisma.group.upsert({
      where: { slug: NRG_SLUG },
      update: {},
      create: {
        slug: NRG_SLUG,
        name: 'NRG',
        description:
          'Turn your network into real referrals. NRG is a private community of business owners who send each other warm, AI-matched introductions - plus live Zoom events and lifetime Premium access. Request to join and start growing by referral.',
        city: 'National',
        state: 'US',
        isPublic: true,
        joinPolicy: 'request',
        lockedInterior: true,
        maxMembers: 200,
        primaryColor: '#F5821F', // NRG orange
        logoUrl: 'https://referralnova.com/nrg-logo.png',
        welcomeMessage:
          "Welcome to NRG - you're in the room where referrals happen! RSVP to live Zoom events with one tap, let AI match you with partners who can actually refer you, and introduce yourself in the group chat. Your lifetime Premium access is active.",
      },
      select: { id: true },
    });

    // Resolve the leader accounts that currently exist.
    const named = await prisma.user.findMany({
      where: { email: { in: NRG_LEADERS.map((l) => l.email) }, deletedAt: null },
      select: { id: true, email: true },
    });
    const roleByEmail = new Map(NRG_LEADERS.map((l) => [l.email, l.role]));

    // Every platform admin (except the ROUL support bot) joins as CO_LEADER so
    // they can test and manage what we ship.
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', deletedAt: null, NOT: { email: ROUL_SUPPORT_EMAIL } },
      select: { id: true },
    });

    const wanted = new Map<string, 'LEADER' | 'CO_LEADER'>();
    for (const u of named) wanted.set(u.id, roleByEmail.get(u.email) ?? 'CO_LEADER');
    for (const a of admins) if (!wanted.has(a.id)) wanted.set(a.id, 'CO_LEADER');

    for (const [userId, role] of wanted) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId } },
        update: {}, // never downgrade a role that already exists
        create: { groupId: group.id, userId, role },
      });
    }
    // eslint-disable-next-line no-console
    console.log(`[seed] NRG group ready (${wanted.size} admin/leader members ensured)`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[seed] seedNrgGroup failed (non-fatal):', String(err));
  }
}

/**
 * If a newly-registered user is a named NRG leader, add them to the NRG group
 * with their leader role immediately - so Mike/Lori get access the moment they
 * sign up, not on the next API reboot. No-op for everyone else, and safe if the
 * group has not been created yet (the boot seed wires them later in that case).
 */
export async function ensureNrgLeaderMembership(userId: string, email: string): Promise<void> {
  const role = NRG_LEADERS.find((l) => l.email.toLowerCase() === email.toLowerCase())?.role;
  if (!role) return;
  try {
    const group = await prisma.group.findUnique({ where: { slug: NRG_SLUG }, select: { id: true } });
    if (!group) return;
    const created = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      update: {},
      create: { groupId: group.id, userId, role },
      select: { role: true },
    });
    // Interconnect the new leader with existing members (best-effort).
    await eventBus.publish('group.member_joined', { groupId: group.id, userId });
    // eslint-disable-next-line no-console
    console.log(`[nrg] wired leader ${email} as ${created.role}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[nrg] ensureNrgLeaderMembership failed (non-fatal):', String(err));
  }
}

// ---- Group Zoom events (leaders post, members RSVP) -------------------------

/** Notify every member (except the actor) in-app - best-effort, non-blocking. */
function notifyMembers(
  groupId: string,
  actorId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): void {
  void (async () => {
    const members = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: actorId } },
      select: { userId: true },
    });
    for (const m of members) {
      void createNotification({ userId: m.userId, type, title, body, data }).catch(() => undefined);
    }
  })().catch(() => undefined);
}

/** Create a Zoom event for the group (leaders only). */
export async function createGroupEvent(
  groupId: string,
  userId: string,
  input: { title: string; description?: string; date: Date; meetingUrl?: string; location?: string },
) {
  await assertGroupAdmin(groupId, userId);
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  const event = await prisma.groupEvent.create({
    data: {
      groupId,
      title: sanitizeText(input.title).slice(0, 160),
      description: input.description ? sanitizeText(input.description).slice(0, 2000) : null,
      date: input.date,
      meetingUrl: input.meetingUrl?.trim() || null,
      location: input.location ? sanitizeText(input.location).slice(0, 160) : 'Virtual',
    },
  });
  notifyMembers(
    groupId,
    userId,
    'group_event',
    `New event in ${group?.name ?? 'your group'}`,
    input.title,
    { groupId, eventId: event.id },
  );
  return event;
}

/** Upcoming events for a group with the viewer's RSVP status (members only). */
export async function listGroupEvents(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);
  const events = await prisma.groupEvent.findMany({
    where: { groupId, date: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      location: true,
      meetingUrl: true,
      _count: { select: { rsvps: true } },
      rsvps: { where: { userId }, select: { id: true } },
    },
  });
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date,
    location: e.location,
    meetingUrl: e.meetingUrl,
    attendeeCount: e._count.rsvps,
    viewerGoing: e.rsvps.length > 0,
  }));
}

/** Toggle the caller's RSVP on a group event (members only). Returns new state. */
export async function toggleEventRsvp(eventId: string, userId: string) {
  const event = await prisma.groupEvent.findUnique({
    where: { id: eventId },
    select: { id: true, groupId: true },
  });
  if (!event) throw AppError.notFound('Event not found');
  await assertGroupMember(event.groupId, userId);

  const existing = await prisma.groupEventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.groupEventRsvp.delete({ where: { id: existing.id } }),
      prisma.groupEvent.update({ where: { id: eventId }, data: { rsvpCount: { decrement: 1 } } }),
    ]);
    return { going: false };
  }
  // Create the RSVP; ignore a unique-collision from a double-tap race.
  try {
    await prisma.$transaction([
      prisma.groupEventRsvp.create({ data: { eventId, userId } }),
      prisma.groupEvent.update({ where: { id: eventId }, data: { rsvpCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (!(err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002')) {
      throw err;
    }
  }
  return { going: true };
}

/** Delete a group event (leaders only). */
export async function deleteGroupEvent(eventId: string, userId: string) {
  const event = await prisma.groupEvent.findUnique({
    where: { id: eventId },
    select: { groupId: true },
  });
  if (!event) throw AppError.notFound('Event not found');
  await assertGroupAdmin(event.groupId, userId);
  await prisma.groupEvent.delete({ where: { id: eventId } });
  return { ok: true };
}

// ---- Group announcements (leaders post, members read) -----------------------

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
} as const;

/** Post an announcement to the group (leaders only). */
export async function createAnnouncement(
  groupId: string,
  userId: string,
  input: { title: string; body: string },
) {
  await assertGroupAdmin(groupId, userId);
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  const announcement = await prisma.groupAnnouncement.create({
    data: {
      groupId,
      authorId: userId,
      title: sanitizeText(input.title).slice(0, 160),
      body: sanitizeText(input.body).slice(0, 4000),
    },
    select: announcementSelect,
  });
  notifyMembers(
    groupId,
    userId,
    'group_announcement',
    `Announcement in ${group?.name ?? 'your group'}`,
    input.title,
    { groupId, announcementId: announcement.id },
  );
  return announcement;
}

/** Recent announcements for a group (members only). */
export async function listAnnouncements(groupId: string, userId: string) {
  await assertGroupMember(groupId, userId);
  return prisma.groupAnnouncement.findMany({
    where: { groupId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: announcementSelect,
  });
}

/** Delete an announcement (leaders only). */
export async function deleteAnnouncement(announcementId: string, userId: string) {
  const a = await prisma.groupAnnouncement.findUnique({
    where: { id: announcementId },
    select: { groupId: true },
  });
  if (!a) throw AppError.notFound('Announcement not found');
  await assertGroupAdmin(a.groupId, userId);
  await prisma.groupAnnouncement.delete({ where: { id: announcementId } });
  return { ok: true };
}
