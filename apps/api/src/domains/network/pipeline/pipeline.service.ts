import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';

/**
 * GHL-style pipeline — every prospect (message lead, intro, consumer lead,
 * referral, booking, contract partner) becomes a card that the member moves
 * across stages. Analytics reads stages straight from this table, so moving
 * a card IS updating the report.
 *
 * Sync rules:
 *  - cards are created automatically from real activity (idempotent);
 *  - activity only ever advances a card forward (booking → zoom_booked,
 *    signed contract → contract_signed), never backwards;
 *  - terminal stages (won / lost / dead) are never touched by sync — only
 *    the member decides those.
 */

export const PIPELINE_STAGES = [
  'new',
  'in_process',
  'zoom_booked',
  'follow_up',
  'signing_contract',
  'contract_signed',
  'won',
  'lost',
  'dead',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const TERMINAL: PipelineStage[] = ['won', 'lost', 'dead'];
const stageRank = (s: string): number => PIPELINE_STAGES.indexOf(s as PipelineStage);

const cardSelect = {
  id: true,
  contactUserId: true,
  consumerLeadId: true,
  name: true,
  email: true,
  source: true,
  stage: true,
  notes: true,
  stageUpdatedAt: true,
  createdAt: true,
  contact: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      memberProfile: { select: { businessName: true, industry: true } },
    },
  },
} as const;

async function ensureContactCard(
  ownerId: string,
  contact: { id: string; firstName: string; lastName: string; email?: string | null },
  source: string,
) {
  const existing = await prisma.pipelineCard.findFirst({
    where: { ownerId, contactUserId: contact.id },
    select: { id: true, stage: true },
  });
  if (existing) return existing;
  return prisma.pipelineCard.create({
    data: {
      ownerId,
      contactUserId: contact.id,
      name: `${contact.firstName} ${contact.lastName}`.trim() || 'Member',
      email: contact.email ?? null,
      source,
      stage: 'new',
    },
    select: { id: true, stage: true },
  });
}

/** Advance a card forward (never backwards, never out of a terminal stage). */
async function advanceCard(cardId: string, currentStage: string, to: PipelineStage) {
  if (TERMINAL.includes(currentStage as PipelineStage)) return;
  if (stageRank(currentStage) >= stageRank(to)) return;
  await prisma.pipelineCard.update({
    where: { id: cardId },
    data: { stage: to, stageUpdatedAt: new Date() },
  });
}

/** Idempotent sync: turn real platform activity into pipeline cards. */
export async function syncPipeline(ownerId: string): Promise<void> {
  // 1. Every conversation with at least one message → a card for the peer.
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: ownerId } } },
    select: {
      id: true,
      participants: {
        select: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      messages: { take: 1, select: { id: true } },
    },
    take: 200,
  });
  for (const c of conversations) {
    if (c.messages.length === 0) continue;
    const peer = c.participants.map((p) => p.user).find((u) => u.id !== ownerId);
    if (!peer) continue;
    await ensureContactCard(ownerId, peer, 'message');
  }

  // 2. Intro requests I accepted (or that were accepted for me) → card.
  const intros = await prisma.introduction.findMany({
    where: {
      status: 'accepted',
      OR: [{ senderId: ownerId }, { targetId: ownerId }],
    },
    select: {
      senderId: true,
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      target: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  for (const i of intros) {
    const peer = i.senderId === ownerId ? i.target : i.sender;
    await ensureContactCard(ownerId, peer, 'intro');
  }

  // 3. Client referrals I received → a card per referral sender's client.
  const referrals = await prisma.referral.findMany({
    where: { receiverId: ownerId },
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      status: true,
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  for (const r of referrals) {
    // The referred CLIENT is the prospect. Key by the sending member so
    // repeat referrals from the same partner stay on one card per client.
    const name = r.clientName?.trim() || `Referral from ${r.sender.firstName} ${r.sender.lastName}`;
    const found = await prisma.pipelineCard.findFirst({
      where: { ownerId, source: 'referral', name },
      select: { id: true },
    });
    if (!found) {
      await prisma.pipelineCard.create({
        data: {
          ownerId,
          name,
          email: r.clientEmail ?? null,
          source: 'referral',
          stage: r.status === 'CONVERTED' ? 'won' : 'new',
          notes: `Referred by ${r.sender.firstName} ${r.sender.lastName}`,
        },
      });
    }
  }

  // 4. Consumer leads on my listings → card each.
  const consumerLeads = await prisma.consumerLead.findMany({
    where: { listing: { userId: ownerId, deletedAt: null } },
    select: {
      id: true,
      status: true,
      consumer: { select: { firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  for (const l of consumerLeads) {
    const existing = await prisma.pipelineCard.findFirst({
      where: { ownerId, consumerLeadId: l.id },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.pipelineCard.create({
      data: {
        ownerId,
        consumerLeadId: l.id,
        name: `${l.consumer.firstName} ${l.consumer.lastName}`.trim() || 'Consumer lead',
        email: l.consumer.email,
        source: 'consumer',
        stage: l.status === 'CONVERTED' ? 'won' : 'new',
      },
    });
  }

  // 5. Confirmed bookings advance the peer's card to zoom_booked.
  const bookings = await prisma.bookingCall.findMany({
    where: {
      OR: [{ hostId: ownerId }, { guestId: ownerId }],
      status: { in: ['confirmed', 'completed'] },
    },
    select: {
      hostId: true,
      host: { select: { id: true, firstName: true, lastName: true, email: true } },
      guest: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  for (const b of bookings) {
    const peer = b.hostId === ownerId ? b.guest : b.host;
    const card = await ensureContactCard(ownerId, peer, 'booking');
    await advanceCard(card.id, card.stage, 'zoom_booked');
  }

  // 6. Contracts advance the peer's card: sent → signing_contract,
  //    signed → contract_signed.
  const contracts = await prisma.contract.findMany({
    where: { OR: [{ senderId: ownerId }, { receiverId: ownerId }] },
    select: {
      senderId: true,
      status: true,
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 200,
  });
  for (const c of contracts) {
    const peer = c.senderId === ownerId ? c.receiver : c.sender;
    const card = await ensureContactCard(ownerId, peer, 'contract');
    if (c.status === 'signed') await advanceCard(card.id, card.stage, 'contract_signed');
    else if (c.status === 'sent') await advanceCard(card.id, card.stage, 'signing_contract');
  }
}

export async function listPipeline(ownerId: string) {
  try {
    await syncPipeline(ownerId);
  } catch {
    // Sync is best-effort — the board must still render existing cards.
  }
  return prisma.pipelineCard.findMany({
    where: { ownerId },
    orderBy: { stageUpdatedAt: 'desc' },
    take: 500,
    select: cardSelect,
  });
}

export async function createCard(
  ownerId: string,
  input: { name: string; email?: string; notes?: string; stage?: string },
) {
  const stage = input.stage && PIPELINE_STAGES.includes(input.stage as PipelineStage) ? input.stage : 'new';
  return prisma.pipelineCard.create({
    data: {
      ownerId,
      name: sanitizeText(input.name).slice(0, 120),
      email: input.email?.slice(0, 200) ?? null,
      notes: input.notes ? sanitizeText(input.notes).slice(0, 2000) : null,
      source: 'manual',
      stage,
    },
    select: cardSelect,
  });
}

export async function updateCard(
  ownerId: string,
  cardId: string,
  patch: { stage?: string; notes?: string },
) {
  const card = await prisma.pipelineCard.findFirst({
    where: { id: cardId, ownerId },
    select: { id: true, stage: true, consumerLeadId: true },
  });
  if (!card) throw AppError.notFound('Pipeline card not found');

  const data: { stage?: string; stageUpdatedAt?: Date; notes?: string | null } = {};
  if (patch.stage !== undefined) {
    if (!PIPELINE_STAGES.includes(patch.stage as PipelineStage)) {
      throw AppError.badRequest(`Unknown stage "${patch.stage}"`);
    }
    data.stage = patch.stage;
    data.stageUpdatedAt = new Date();
  }
  if (patch.notes !== undefined) data.notes = sanitizeText(patch.notes).slice(0, 2000) || null;

  const updated = await prisma.pipelineCard.update({
    where: { id: card.id },
    data,
    select: cardSelect,
  });

  // Winning a consumer-lead card marks the underlying lead converted so the
  // legacy consumer-lead metrics stay in step with the pipeline.
  if (patch.stage === 'won' && card.consumerLeadId) {
    await prisma.consumerLead
      .update({
        where: { id: card.consumerLeadId },
        data: { status: 'CONVERTED', convertedAt: new Date() },
      })
      .catch(() => undefined);
  }
  return updated;
}

export async function deleteCard(ownerId: string, cardId: string) {
  const card = await prisma.pipelineCard.findFirst({
    where: { id: cardId, ownerId },
    select: { id: true },
  });
  if (!card) throw AppError.notFound('Pipeline card not found');
  await prisma.pipelineCard.delete({ where: { id: card.id } });
}

/** Stage counts + win metrics for analytics. */
export async function pipelineStats(ownerId: string) {
  const rows = await prisma.pipelineCard.groupBy({
    by: ['stage'],
    where: { ownerId },
    _count: { _all: true },
  });
  const byStage = Object.fromEntries(rows.map((r) => [r.stage, r._count._all])) as Record<
    string,
    number
  >;
  const total = rows.reduce((a, r) => a + r._count._all, 0);
  const won = byStage.won ?? 0;
  const lost = (byStage.lost ?? 0) + (byStage.dead ?? 0);
  const closed = won + lost;
  return {
    stages: PIPELINE_STAGES.map((s) => ({ stage: s, count: byStage[s] ?? 0 })),
    total,
    won,
    lost,
    open: total - closed,
    winRate: closed === 0 ? 0 : Math.round((won / closed) * 100),
  };
}
