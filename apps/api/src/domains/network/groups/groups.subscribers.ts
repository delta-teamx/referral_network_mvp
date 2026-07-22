import type { EventBus } from '../../core/events/EventBus.js';
import { prisma } from '../../../config/prisma.js';

/**
 * Group subscribers — make group membership actually interconnect people.
 *
 * `group.member_joined` previously fired into a void, so joining a group had no
 * behavioural effect: co-members never showed up in each other's network and
 * weren't matchable. Here we auto-create an accepted BusinessConnection between
 * the new member and every existing member of the group, so a group becomes a
 * real, interconnected network the moment you join it.
 *
 * Runs through the event bus, which swallows subscriber errors — a failure here
 * never blocks the join itself.
 */
export function registerGroupSubscribers(bus: EventBus): void {
  bus.subscribe('group.member_joined', async ({ groupId, userId }) => {
    const coMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: userId } },
      select: { userId: true },
    });
    if (coMembers.length === 0) return;
    const otherIds = coMembers.map((m) => m.userId);

    // Skip pairs that already have a connection in either direction.
    const existing = await prisma.businessConnection.findMany({
      where: {
        OR: [
          { initiatorId: userId, targetId: { in: otherIds } },
          { targetId: userId, initiatorId: { in: otherIds } },
        ],
      },
      select: { initiatorId: true, targetId: true },
    });
    const alreadyConnected = new Set<string>();
    for (const c of existing) {
      alreadyConnected.add(c.initiatorId === userId ? c.targetId : c.initiatorId);
    }

    const rows = otherIds
      .filter((id) => !alreadyConnected.has(id))
      .map((id) => ({
        initiatorId: userId,
        targetId: id,
        status: 'accepted',
        acceptedAt: new Date(),
      }));

    if (rows.length > 0) {
      await prisma.businessConnection.createMany({ data: rows, skipDuplicates: true });
    }
  });
}
