import type { User } from '@prisma/client';
import type {
  AuthSuccessDto,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { generateToken, hashToken } from '../../../utils/crypto.js';
import { hashPassword, verifyPassword } from '../../../utils/password.js';
import {
  accessTokenSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../../utils/tokens.js';
import { findUserByEmail, toAuthenticatedUserDto } from '../users/users.service.js';
import { eventBus } from '../events/index.js';
import { sendEmail } from '../notifications/email.service.js';
import { env } from '../../../config/env.js';
import { assertEmailIsCredible } from './email.credibility.js';

/**
 * Internal service return — carries the refresh token that the route
 * layer places in an HTTP-only cookie. Never sent as JSON to clients.
 */
export interface AuthResult {
  dto: AuthSuccessDto;
  refreshToken: string;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a new account + initial session. Publishes `user.signed_up`
 * which the onboarding subscriber uses to seed an OnboardingProgress row.
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  await assertEmailIsCredible(input.email);

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict('An account with this email already exists.', 'auth/email_taken');
  }

  const passwordHash = await hashPassword(input.password);
  const emailVerifyToken = generateToken(32);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      role: input.role,
      emailVerifyToken: hashToken(emailVerifyToken),
    },
  });

  await eventBus.publish('user.signed_up', {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Fire-and-forget — email service logs to console in dev.
  void sendEmail({
    to: user.email,
    template: 'verify_email',
    data: {
      firstName: user.firstName,
      verifyUrl: `${env.FRONTEND_URL}/verify-email?token=${emailVerifyToken}`,
    },
  });

  return buildAuthSuccess(user);
}

/** Email+password login. */
export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);
  if (!user || !user.passwordHash) {
    // Don't leak whether the email exists.
    throw AppError.unauthorized('Invalid email or password', 'auth/invalid_credentials');
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw AppError.unauthorized('Invalid email or password', 'auth/invalid_credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await eventBus.publish('user.logged_in', { userId: user.id });

  return buildAuthSuccess(user);
}

/**
 * Exchange a refresh token for a fresh access token. Does not rotate the
 * refresh token in Branch 2 — rotation + revocation DB rows land in
 * Branch 4 alongside the BullMQ event bus (keeps this PR focused).
 */
export async function refresh(refreshTokenRaw: string): Promise<AuthResult> {
  const claims = verifyRefreshToken(refreshTokenRaw);
  const user = await prisma.user.findFirst({
    where: { id: claims.sub, deletedAt: null },
  });
  if (!user) throw AppError.unauthorized('Session no longer valid');
  return buildAuthSuccess(user);
}

/** Email verification — consumes the token stored at signup. */
export async function verifyEmailToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: tokenHash, deletedAt: null },
  });
  if (!user) throw AppError.badRequest('Invalid or expired verification link');

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyToken: null },
  });

  await eventBus.publish('user.email_verified', { userId: user.id });
}

/**
 * Always returns success even if the email doesn't exist — avoids exposing
 * which addresses are registered.
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const user = await findUserByEmail(input.email);
  if (!user) return;

  const token = generateToken(24);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashToken(token),
      resetTokenExpiry: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  void sendEmail({
    to: user.email,
    template: 'password_reset',
    data: {
      firstName: user.firstName,
      resetUrl: `${env.FRONTEND_URL}/reset-password?token=${token}`,
    },
  });
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiry: { gt: new Date() },
      deletedAt: null,
    },
  });
  if (!user) throw AppError.badRequest('Reset link is invalid or has expired');

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
}

// ---- internals ---------------------------------------------------------------

async function buildAuthSuccess(user: User): Promise<AuthResult> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tier: user.subscriptionTier,
    ev: user.emailVerified,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    jti: generateToken(16),
  });
  return {
    dto: {
      user: await toAuthenticatedUserDto(user),
      tokens: {
        accessToken,
        expiresIn: accessTokenSeconds(),
      },
    },
    refreshToken,
  };
}
