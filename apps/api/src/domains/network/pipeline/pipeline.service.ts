import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sanitizeText } from '../../../utils/sanitize.js';

/**
 * GHL-style pipeline - every prospect (message lead, intro, consumer lead,
 * referral, booking, contract partner) becomes a card that the member moves
 * across stages. Analytics reads stages straight from this table, so moving
 * a card IS updating the report.
 *
 * Sync rules:
 *  - cards are created automatically from real activity (idempotent);
 *  - activity only ever advances a card forward (booking → zoom_booked,
 *    signed contract → contract_signed), never backwards;
 *  - terminal stages (won / lost / dead) are never touched by sync - only
 *    the member decides those.
 */

export const PIPELINE_STAGES = [
  'new',
  'in_process',
  'zoom_booked',
  'follow_up',
  'signing_contract',
  'won', // "Won - deal signed": a signed contract IS a won deal
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

type CardRec = { id: string; stage: string };

/**
 * Return the peer's card, creating it if missing. Reads/writes the preloaded
 * `cardByContact` map so the whole sync is one findMany + only the genuinely
 * new cards, never a findFirst per peer (that N+1 is what capped the sync).
 */
async function ensureContactCard(
  ownerId: string,
  contact: { id: string; firstName: string; lastName: string; email?: string | null },
  source: string,
  cardByContact: Map<string, CardRec>,
): Promise<CardRec> {
  const existing = cardByContact.get(contact.id);
  if (existing) return existing;
  const created = await prisma.pipelineCard.create({
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
  const rec: CardRec = { id: created.id, stage: created.stage };
  cardByContact.set(contact.id, rec);
  return rec;
}

/**
 * Advance a card forward (never backwards, never out of a terminal stage).
 * Mutates the passed record's stage after a successful update so a later
 * section in the same run sees the fresh stage and can't move it backward.
 */
async function advanceCard(card: CardRec, to: PipelineStage) {
  if (TERMINAL.includes(card.stage as PipelineStage)) return;
  if (stageRank(card.stage) >= stageRank(to)) return;
  await prisma.pipelineCard.update({
    where: { id: card.id },
    data: { stage: to, stageUpdatedAt: new Date() },
  });
  card.stage = to;
}

/** Idempotent sync: turn real platform activity into pipeline cards. */
export async function syncPipeline(ownerId: string): Promise<void> {
  // Legacy stage merge: contract_signed and won are now ONE stage
  // ("Won - deal signed") - a signed contract is a won deal.
  await prisma.pipelineCard
    .updateMany({ where: { ownerId, stage: 'contract_signed' }, data: { stage: 'won' } })
    .catch(() => undefined);

  // Preload this owner's existing cards ONCE, keyed the three ways sync looks
  // them up (by contact user, by referral name, by consumer-lead id). Every
  // section then dedups against an in-memory Set/Map instead of a findFirst per
  // row, so the per-section caps below can be raised without an N+1 blow-up.
  const [existingContactCards, existingReferralCards, existingConsumerCards] = await Promise.all([
    prisma.pipelineCard.findMany({
      where: { ownerId, contactUserId: { not: null } },
      select: { id: true, contactUserId: true, stage: true },
      take: 5000,
    }),
    prisma.pipelineCard.findMany({
      where: { ownerId, source: 'referral' },
      select: { name: true },
      take: 5000,
    }),
    prisma.pipelineCard.findMany({
      where: { ownerId, consumerLeadId: { not: null } },
      select: { consumerLeadId: true },
      take: 5000,
    }),
  ]);
  const cardByContact = new Map<string, CardRec>();
  for (const c of existingContactCards) {
    if (c.contactUserId) cardByContact.set(c.contactUserId, { id: c.id, stage: c.stage });
  }
  const referralNames = new Set(existingReferralCards.map((c) => c.name));
  const consumerLeadIds = new Set(
    existingConsumerCards
      .map((c) => c.consumerLeadId)
      .filter((id): id is string => id !== null),
  );

  // Peers this member has ACTUALLY engaged with - used at the end to
  // auto-resolve stale intro requests (the system stays interconnected:
  // once you've messaged / met / contracted, an intro request is moot).
  const engagedPeerIds = new Set<string>();

  // 1. Every conversation with at least one message → a card for the peer.
  //    EXCEPT official "ROUL Support" threads (admin outreach), which are just
  //    a message in the inbox and must never appear as a lead on the pipeline.
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: ownerId } }, isOfficial: false },
    select: {
      id: true,
      participants: {
        select: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
      },
      messages: { take: 1, select: { id: true } },
    },
    take: 1000,
  });
  for (const c of conversations) {
    if (c.messages.length === 0) continue;
    const peer = c.participants.map((p) => p.user).find((u) => u.id !== ownerId);
    if (!peer) continue;
    // Admins (incl. the ROUL Support system account) are never leads.
    if (peer.role === 'ADMIN') continue;
    engagedPeerIds.add(peer.id);
    await ensureContactCard(ownerId, peer, 'message', cardByContact);
  }

  // 2. Intros → card. Accepted (either direction) AND my own still-pending
  //    outbound request: the moment I request an intro, that contact leaves my
  //    AI suggestions and belongs here in my pipeline as a lead.
  const intros = await prisma.introduction.findMany({
    where: {
      OR: [
        { status: 'accepted', OR: [{ senderId: ownerId }, { targetId: ownerId }] },
        { status: 'requested', senderId: ownerId },
      ],
    },
    select: {
      senderId: true,
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      target: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    take: 1000,
  });
  for (const i of intros) {
    const peer = i.senderId === ownerId ? i.target : i.sender;
    await ensureContactCard(ownerId, peer, 'intro', cardByContact);
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
    take: 1000,
  });
  for (const r of referrals) {
    // The referred CLIENT is the prospect. Key by the sending member so
    // repeat referrals from the same partner stay on one card per client.
    const name = r.clientName?.trim() || `Referral from ${r.sender.firstName} ${r.sender.lastName}`;
    if (referralNames.has(name)) continue;
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
    referralNames.add(name);
  }

  // 4. Consumer leads on my listings → card each.
  const consumerLeads = await prisma.consumerLead.findMany({
    where: { listing: { userId: ownerId, deletedAt: null } },
    select: {
      id: true,
      status: true,
      consumer: { select: { firstName: true, lastName: true, email: true } },
    },
    take: 1000,
  });
  for (const l of consumerLeads) {
    if (consumerLeadIds.has(l.id)) continue;
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
    consumerLeadIds.add(l.id);
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
    take: 1000,
  });
  for (const b of bookings) {
    const peer = b.hostId === ownerId ? b.guest : b.host;
    engagedPeerIds.add(peer.id);
    const card = await ensureContactCard(ownerId, peer, 'booking', cardByContact);
    await advanceCard(card, 'zoom_booked');
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
    take: 1000,
  });
  for (const c of contracts) {
    const peer = c.senderId === ownerId ? c.receiver : c.sender;
    engagedPeerIds.add(peer.id);
    const card = await ensureContactCard(ownerId, peer, 'contract', cardByContact);
    // A signed contract IS a won deal.
    if (c.status === 'signed') await advanceCard(card, 'won');
    else if (c.status === 'sent') await advanceCard(card, 'signing_contract');
  }

  // 7. Connections → card + engagement. An accepted connection (either
  //    direction) or my own still-pending outbound request means that contact
  //    has left my AI suggestions, so they must land here in the pipeline as a
  //    lead (mirrors the intro rule) - not vanish into neither list.
  const connections = await prisma.businessConnection.findMany({
    where: {
      OR: [
        { status: 'accepted', OR: [{ initiatorId: ownerId }, { targetId: ownerId }] },
        { status: 'pending', initiatorId: ownerId },
      ],
    },
    select: {
      initiatorId: true,
      status: true,
      initiator: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      target: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    take: 1000,
  });
  for (const c of connections) {
    const peer = c.initiatorId === ownerId ? c.target : c.initiator;
    // Never card an admin/system account as a lead.
    if (peer.role === 'ADMIN') continue;
    if (c.status === 'accepted') engagedPeerIds.add(peer.id);
    await ensureContactCard(ownerId, peer, 'connection', cardByContact);
  }

  // 8. INTERCONNECTION HEAL: an intro request between two people who already
  //    message / met on Zoom / signed a contract / are connected is stale -
  //    resolve it so it stops resurfacing as "waiting for response".
  if (engagedPeerIds.size > 0) {
    const peers = [...engagedPeerIds];
    await prisma.introduction
      .updateMany({
        where: {
          status: { in: ['suggested', 'requested'] },
          OR: [
            { senderId: ownerId, targetId: { in: peers } },
            { targetId: ownerId, senderId: { in: peers } },
          ],
        },
        data: { status: 'accepted', acceptedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

export async function listPipeline(ownerId: string) {
  try {
    await syncPipeline(ownerId);
  } catch {
    // Sync is best-effort - the board must still render existing cards.
  }
  return prisma.pipelineCard.findMany({
    // Never show admin/ROUL-Support contacts as leads (belt-and-suspenders on
    // top of the sync exclusion + the boot heal). Cards without a member
    // contact (manual / referral / consumer leads) are unaffected.
    where: {
      ownerId,
      OR: [{ contactUserId: null }, { contact: { role: { not: 'ADMIN' } } }],
    },
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
