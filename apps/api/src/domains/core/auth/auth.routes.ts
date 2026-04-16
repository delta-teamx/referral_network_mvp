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
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    const body: ApiResponse<{ reset: true }> = { success: true, data: { reset: true } };
    res.json(body);
  }),
);

authRouter.get(
  '/verify-email/:token',
  asyncHandler(async (req, res) => {
    const parsed = verifyEmailSchema.parse({ token: req.params.token });
    await verifyEmailToken(parsed.token);
    const body: ApiResponse<{ verified: true }> = { success: true, data: { verified: true } };
    res.json(body);
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
      data: toAuthenticatedUserDto(user),
    };
    res.json(body);
  }),
);
