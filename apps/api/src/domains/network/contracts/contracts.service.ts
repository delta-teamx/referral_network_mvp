import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { env } from '../../../config/env.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../../core/notifications/notifications.service.js';
import { sendEmail } from '../../core/notifications/email.service.js';

/**
 * Platform contracts — two members formalise a collaboration by signing the
 * platform's standard contract in-app.
 *
 * Flow: sender creates + signs (typed signature) → receiver gets bell + email
 * → receiver signs (status 'signed') or declines. Admins are CC'd on every
 * contract email and can list all contracts (the admin "CC bar").
 */

const contractSelect = {
  id: true,
  title: true,
  body: true,
  status: true,
  senderSignature: true,
  receiverSignature: true,
  senderSignedAt: true,
  receiverSignedAt: true,
  createdAt: true,
  sender: { select: { id: true, firstName: true, lastName: true, email: true } },
  receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

function appOrigin(): string {
  return env.FRONTEND_URL.split(',')[0] ?? 'https://dashboard.referralnova.com';
}

async function emailAdmins(template: 'contract_sent' | 'contract_signed', data: Record<string, unknown>) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { email: true },
  });
  await Promise.all(admins.map((a) => sendEmail({ to: a.email, template, data })));
}

export async function createContract(input: {
  senderId: string;
  receiverUserId: string;
  title: string;
  body: string;
  senderSignature: string;
}) {
  if (input.receiverUserId === input.senderId) {
    throw AppError.badRequest("You can't send a contract to yourself.");
  }
  const receiver = await prisma.user.findFirst({
    where: { id: input.receiverUserId, deletedAt: null },
    select: { id: true, email: true, firstName: true },
  });
  if (!receiver) throw AppError.notFound('Member not found');

  const contract = await prisma.contract.create({
    data: {
      title: sanitizeText(input.title).slice(0, 200),
      body: input.body.slice(0, 20_000),
      senderId: input.senderId,
      receiverId: receiver.id,
      senderSignature: sanitizeText(input.senderSignature).slice(0, 120),
      status: 'sent',
    },
    select: contractSelect,
  });

  const contractUrl = `${appOrigin()}/dashboard/referrals`;
  const senderName = `${contract.sender.firstName} ${contract.sender.lastName}`;

  void createNotification({
    userId: receiver.id,
    type: 'contract',
    title: `${senderName} sent you a contract to sign`,
    body: `"${contract.title}" — review and sign it in Contracts & Legal.`,
    data: { contractId: contract.id },
  }).catch(() => undefined);

  void sendEmail({
    to: receiver.email,
    template: 'contract_sent',
    data: { title: contract.title, senderName, contractUrl },
  });
  // Admins are CC'd on every contract.
  void emailAdmins('contract_sent', {
    title: `${contract.title} (to ${contract.receiver.firstName} ${contract.receiver.lastName})`,
    senderName,
    contractUrl: `${appOrigin()}/admin/contracts`,
  }).catch(() => undefined);

  return contract;
}

export async function listMyContracts(userId: string) {
  return prisma.contract.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: contractSelect,
  });
}

export async function signContract(contractId: string, userId: string, signature: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, receiverId: userId, status: 'sent' },
    select: { id: true },
  });
  if (!contract) throw AppError.notFound('Contract not found or already handled');

  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: 'signed',
      receiverSignature: sanitizeText(signature).slice(0, 120),
      receiverSignedAt: new Date(),
    },
    select: contractSelect,
  });

  const senderName = `${updated.sender.firstName} ${updated.sender.lastName}`;
  const receiverName = `${updated.receiver.firstName} ${updated.receiver.lastName}`;
  const contractUrl = `${appOrigin()}/dashboard/referrals`;

  void createNotification({
    userId: updated.sender.id,
    type: 'contract',
    title: `${receiverName} signed your contract ✅`,
    body: `"${updated.title}" is now signed by both parties.`,
    data: { contractId: updated.id },
  }).catch(() => undefined);

  // Both parties + all admins get the signed confirmation.
  void sendEmail({
    to: updated.sender.email,
    template: 'contract_signed',
    data: { title: updated.title, senderName, receiverName, contractUrl },
  });
  void sendEmail({
    to: updated.receiver.email,
    template: 'contract_signed',
    data: { title: updated.title, senderName, receiverName, contractUrl },
  });
  void emailAdmins('contract_signed', {
    title: updated.title,
    senderName,
    receiverName,
    contractUrl: `${appOrigin()}/admin/contracts`,
  }).catch(() => undefined);

  return updated;
}

export async function declineContract(contractId: string, userId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, receiverId: userId, status: 'sent' },
    select: { id: true },
  });
  if (!contract) throw AppError.notFound('Contract not found or already handled');

  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { status: 'declined' },
    select: contractSelect,
  });

  void createNotification({
    userId: updated.sender.id,
    type: 'contract',
    title: `${updated.receiver.firstName} ${updated.receiver.lastName} declined your contract`,
    body: `"${updated.title}" was declined.`,
    data: { contractId: updated.id },
  }).catch(() => undefined);

  return updated;
}

/** Admin: every contract on the platform. */
export async function listAllContracts() {
  return prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: contractSelect,
  });
}
