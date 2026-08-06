import { prisma } from '../../../config/prisma.js';

/**
 * Every userId that `userId` is already ENGAGED with - anyone they have ACTED
 * on an introduction with (requested / accepted / completed / declined, either
 * direction), a business connection, a conversation, or a pipeline card with.
 *
 * NB: a bare `status: 'suggested'` introduction is NOT engagement - it is the
 * matcher's own pick that hasn't been acted on yet. It must be EXCLUDED here,
 * otherwise every fresh suggestion would filter itself out of the feed (the
 * suggested row makes its own target look "engaged") and the feed goes blank.
 *
 * Used to keep already-engaged contacts OUT of AI suggestions: the moment you
 * request an intro (or connect / message / pipeline someone), they leave your
 * suggestions for good and live only in your pipeline. Best-effort/read-only.
 */
export async function getEngagedPeerIds(userId: string): Promise<Set<string>> {
  const [intros, connections, myConvoParts, cards] = await Promise.all([
    prisma.introduction.findMany({
      where: {
        status: { not: 'suggested' },
        OR: [{ senderId: userId }, { targetId: userId }],
      },
      select: { senderId: true, targetId: true },
      take: 2000,
    }),
    prisma.businessConnection.findMany({
      where: { OR: [{ initiatorId: userId }, { targetId: userId }] },
      select: { initiatorId: true, targetId: true },
      take: 2000,
    }),
    prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
      take: 1000,
    }),
    prisma.pipelineCard.findMany({
      where: { ownerId: userId, contactUserId: { not: null } },
      select: { contactUserId: true },
      take: 2000,
    }),
  ]);

  const engaged = new Set<string>();
  for (const i of intros) {
    engaged.add(i.senderId);
    engaged.add(i.targetId);
  }
  for (const c of connections) {
    engaged.add(c.initiatorId);
    engaged.add(c.targetId);
  }
  for (const c of cards) {
    if (c.contactUserId) engaged.add(c.contactUserId);
  }

  // The other participant in each of my conversations.
  if (myConvoParts.length > 0) {
    const peers = await prisma.conversationParticipant.findMany({
      where: {
        conversationId: { in: myConvoParts.map((p) => p.conversationId) },
        userId: { not: userId },
      },
      select: { userId: true },
      take: 2000,
    });
    for (const p of peers) engaged.add(p.userId);
  }

  engaged.delete(userId);
  return engaged;
}
