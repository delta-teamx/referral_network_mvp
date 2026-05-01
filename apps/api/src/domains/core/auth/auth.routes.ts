import { Router } from 'express';
import type { Response } from 'express';
import type { ApiResponse, AuthSuccessDto, AuthenticatedUserDto } from '@refnet/shared';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '@refnet/shared';
import { validate } from '../../../middleware/validate.js';
import { authenticate } from '../../../middleware/authenticate.js';
import { authRateLimit, rateLimit, signupRateLimit } from '../../../middleware/rateLimit.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  login,
  refresh,
  requestPasswordReset,
  resetPassword,
  signup,
  verifyEmailToken,
} from './auth.service.js';
import {
  buildGoogleAuthUrl,
  completeGoogleOAuth,
  generateStateToken,
  isGoogleOAuthConfigured,
  buildFacebookAuthUrl,
  completeFacebookOAuth,
  isFacebookOAuthConfigured,
} from './oauth.service.js';
import { findUserById, toAuthenticatedUserDto } from '../users/users.service.js';

export const authRouter: Router = Router();

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30d

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}

authRouter.post(
  '/signup',
  signupRateLimit,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await signup(req.body);
    setRefreshCookie(res, result.refreshToken);
    const body: ApiResponse<AuthSuccessDto> = { success: true, data: result.dto };
    res.status(201).json(body);
  }),
);

authRouter.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await login(req.body);
    setRefreshCookie(res, result.refreshToken);
    const body: ApiResponse<AuthSuccessDto> = { success: true, data: result.dto };
    res.json(body);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
    if (!token) throw AppError.unauthorized('No refresh token');
    const result = await refresh(token);
    setRefreshCookie(res, result.refreshToken);
    const body: ApiResponse<AuthSuccessDto> = { success: true, data: result.dto };
    res.json(body);
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearRefreshCookie(res);
  const body: ApiResponse<{ loggedOut: true }> = { success: true, data: { loggedOut: true } };
  res.json(body);
});

authRouter.post(
  '/forgot-password',
  authRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    await requestPasswordReset(req.body);
    // Always 200 regardless of whether the email exists (don't leak).
    const body: ApiResponse<{ sent: true }> = { success: true, data: { sent: true } };
    res.json(body);
  }),
);

authRouter.post(
  '/reset-password',
  rateLimit({ windowMs: 60_000, max: 5, key: 'reset-password' }),
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    const body: ApiResponse<{ reset: true }> = { success: true, data: { reset: true } };
    res.json(body);
  }),
);

authRouter.get(
  '/verify-email/:token',
  rateLimit({ windowMs: 60_000, max: 5, key: 'verify-email' }),
  asyncHandler(async (req, res) => {
    const parsed = verifyEmailSchema.parse({ token: req.params.token });
    await verifyEmailToken(parsed.token);
    const body: ApiResponse<{ verified: true }> = { success: true, data: { verified: true } };
    res.json(body);
  }),
);

// ---------- Google OAuth ----------------------------------------------------
// In-memory state store (replaces cookies which fail cross-domain).
// States expire after 10 minutes. Single-process safe; for multi-instance
// deployments, swap to Redis.
const oauthStateStore = new Map<string, number>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function storeOAuthState(state: string): void {
  oauthStateStore.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  // Cleanup expired entries
  for (const [key, exp] of oauthStateStore) {
    if (exp < Date.now()) oauthStateStore.delete(key);
  }
}

function consumeOAuthState(state: string): boolean {
  const exp = oauthStateStore.get(state);
  if (!exp || exp < Date.now()) return false;
  oauthStateStore.delete(state);
  return true;
}

authRouter.get(
  '/oauth/google',
  asyncHandler(async (_req, res) => {
    if (!isGoogleOAuthConfigured()) {
      const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
      res.redirect(`${origin}/oauth/demo`);
      return;
    }
    const state = generateStateToken();
    storeOAuthState(state);
    res.redirect(buildGoogleAuthUrl(state));
  }),
);

authRouter.get(
  '/oauth/google/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state || !consumeOAuthState(state)) {
      throw AppError.badRequest('Invalid OAuth state. Try signing in again.');
    }

    const result = await completeGoogleOAuth(code);
    setRefreshCookie(res, result.refreshToken);

    const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
    const fragment = new URLSearchParams({
      access_token: result.dto.tokens.accessToken,
      expires_in: String(result.dto.tokens.expiresIn),
      user_id: result.dto.user.id,
      is_new: result.isNew ? '1' : '0',
    });
    res.redirect(`${origin}/oauth/complete#${fragment.toString()}`);
  }),
);

// ---------- Facebook OAuth ---------------------------------------------------

authRouter.get(
  '/oauth/facebook',
  asyncHandler(async (_req, res) => {
    if (!isFacebookOAuthConfigured()) {
      const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
      res.redirect(`${origin}/oauth/demo`);
      return;
    }
    const state = generateStateToken();
    storeOAuthState(state);
    res.redirect(buildFacebookAuthUrl(state));
  }),
);

authRouter.get(
  '/oauth/facebook/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state || !consumeOAuthState(state)) {
      throw AppError.badRequest('Invalid OAuth state. Try signing in again.');
    }

    const result = await completeFacebookOAuth(code);
    setRefreshCookie(res, result.refreshToken);

    const origin = env.FRONTEND_URL.split(',')[0] ?? 'http://localhost:3000';
    const fragment = new URLSearchParams({
      access_token: result.dto.tokens.accessToken,
      expires_in: String(result.dto.tokens.expiresIn),
      user_id: result.dto.user.id,
      is_new: result.isNew ? '1' : '0',
    });
    res.redirect(`${origin}/oauth/complete#${fragment.toString()}`);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await findUserById(req.user.id);
    if (!user) throw AppError.unauthorized('Account no longer exists');
    const body: ApiResponse<AuthenticatedUserDto> = {
      success: true,
      data: await toAuthenticatedUserDto(user),
    };
    res.json(body);
  }),
);
