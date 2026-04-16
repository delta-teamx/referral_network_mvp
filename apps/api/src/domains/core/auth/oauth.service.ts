import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../events/index.js';
import { toAuthenticatedUserDto } from '../users/users.service.js';
import {
  accessTokenSeconds,
  signAccessToken,
  signRefreshToken,
} from '../../../utils/tokens.js';
import type { AuthResult } from './auth.service.js';

/**
 * Google OAuth 2.0 — authorization-code flow.
 *
 * We implement it directly against Google's endpoints (no Passport strategy
 * dependency) to keep the bundle small and avoid a webpack-unfriendly
 * transitive. The flow:
 *
 *   1. /api/v1/auth/oauth/google           — issues a signed state cookie
 *                                            and 302s the user to Google
 *   2. /api/v1/auth/oauth/google/callback  — verifies state, trades code
 *                                            for tokens, fetches userinfo,
 *                                            upserts the user, issues our
 *                                            own access/refresh token pair,
 *                                            then 302s to the web app.
 *
 * Demo mode: if GOOGLE_CLIENT_ID is unset, the start endpoint redirects
 * straight to `/oauth/demo` on the web app which fakes a user session so
 * the flow is visible in preview deploys.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
}

export function generateStateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: env.GOOGLE_CALLBACK_URL ?? '',
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: env.GOOGLE_CALLBACK_URL ?? '',
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw AppError.badRequest(`Google token exchange failed: ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw AppError.badRequest('Failed to fetch Google userinfo');
  return (await res.json()) as GoogleUserInfo;
}

async function upsertFromGoogleProfile(profile: GoogleUserInfo): Promise<User> {
  const email = profile.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Mark verified if Google says so — we trust Google more than our own
    // email token on a first click.
    if (!existing.emailVerified && profile.email_verified) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: true, emailVerifyToken: null },
      });
    }
    return existing;
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: null,
      firstName: profile.given_name?.trim() || 'First',
      lastName: profile.family_name?.trim() || 'Last',
      avatarUrl: profile.picture ?? null,
      role: 'CONSUMER',
      emailVerified: profile.email_verified === true,
    },
  });

  await eventBus.publish('user.signed_up', {
    userId: created.id,
    email: created.email,
    role: created.role,
  });

  return created;
}

export async function completeGoogleOAuth(code: string): Promise<AuthResult> {
  const tokens = await exchangeCodeForTokens(code);
  const profile = await fetchUserInfo(tokens.access_token);
  const user = await upsertFromGoogleProfile(profile);

  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tier: user.subscriptionTier,
  });
  const refresh = signRefreshToken({
    sub: user.id,
    jti: crypto.randomBytes(16).toString('hex'),
  });

  return {
    dto: {
      user: toAuthenticatedUserDto(user),
      tokens: {
        accessToken: access,
        expiresIn: accessTokenSeconds(),
      },
    },
    refreshToken: refresh,
  };
}
