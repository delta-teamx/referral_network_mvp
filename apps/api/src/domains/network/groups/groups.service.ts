import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText } from '../../../utils/sanitize.js';

/**
 * Groups — BNI-style local networking circles. A group is public-discoverable
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
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
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

  return {
    ...group,
    viewerRole: (viewerMembership?.role ?? null) as GroupRole | null,
  };
}

export async function joinGroup(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, status: 'active' },
    include: { _count: { select: { members: true } } },
  });
  if (!group) throw AppError.notFound('Group not found');
  if (!group.isPublic) {
    throw AppError.badRequest('This group is invite-only. Ask a leader to add you.');
  }
  if (group._count.members >= group.maxMembers) {
    throw AppError.badRequest('This group is at capacity.');
  }

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });
  if (existing) return { alreadyMember: true };

  await prisma.groupMember.create({
    data: { groupId, userId, role: 'MEMBER' },
  });

  await eventBus.publish('group.member_joined', { groupId, userId });
  return { alreadyMember: false };
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
  return prisma.groupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: groupMessageSelect,
  });
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
