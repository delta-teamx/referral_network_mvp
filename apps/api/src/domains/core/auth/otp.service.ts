import crypto from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { sendEmail } from '../notifications/email.service.js';
import { hashToken } from '../../../utils/crypto.js';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_LENGTH = 6;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendOtp(email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: { id: true, firstName: true, emailVerified: true },
  });
  if (!user) {
    // Don't leak whether the email exists
    return;
  }
  if (user.emailVerified) {
    throw AppError.badRequest('Email is already verified.');
  }

  const otp = generateOtp();
  const otpHash = hashToken(otp);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpCode: otpHash,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await sendEmail({
    to: email,
    template: 'otp',
    data: {
      firstName: user.firstName,
      otpCode: otp,
    },
  });
}

export async function verifyOtp(email: string, code: string): Promise<{ verified: boolean }> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    select: { id: true, otpCode: true, otpExpiresAt: true },
  });
  if (!user || !user.otpCode || !user.otpExpiresAt) {
    throw AppError.badRequest('Invalid or expired code. Request a new one.');
  }

  if (user.otpExpiresAt < new Date()) {
    throw AppError.badRequest('Code has expired. Request a new one.');
  }

  const codeHash = hashToken(code.trim());
  if (codeHash !== user.otpCode) {
    throw AppError.badRequest('Incorrect code. Please try again.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      otpCode: null,
      otpExpiresAt: null,
    },
  });

  return { verified: true };
}
