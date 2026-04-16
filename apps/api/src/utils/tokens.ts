import jwt, { type SignOptions } from 'jsonwebtoken';
import type { SubscriptionTier, UserRole } from '@refnet/shared';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

export interface AccessTokenClaims {
  sub: string; // userId
  email: string;
  role: UserRole;
  tier: SubscriptionTier;
}

export interface RefreshTokenClaims {
  sub: string; // userId
  /** Opaque token ID; DB row tracks revocation + rotation. */
  jti: string;
}

function requireAccessSecret(): string {
  if (!env.JWT_ACCESS_SECRET) {
    throw new AppError(
      'JWT_ACCESS_SECRET is not configured — set it in .env before using auth routes.',
      500,
      'auth/not_configured',
    );
  }
  return env.JWT_ACCESS_SECRET;
}

function requireRefreshSecret(): string {
  if (!env.JWT_REFRESH_SECRET) {
    throw new AppError(
      'JWT_REFRESH_SECRET is not configured — set it in .env before using auth routes.',
      500,
      'auth/not_configured',
    );
  }
  return env.JWT_REFRESH_SECRET;
}

/** Sign a short-lived access token (default 15 min). */
export function signAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] };
  return jwt.sign(claims, requireAccessSecret(), options);
}

/** Sign a long-lived refresh token (default 30 days). */
export function signRefreshToken(claims: RefreshTokenClaims): string {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'] };
  return jwt.sign(claims, requireRefreshSecret(), options);
}

/** Verify an access token and return its claims, or throw 401. */
export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, requireAccessSecret());
    if (typeof decoded !== 'object' || decoded === null) {
      throw AppError.unauthorized('Invalid token');
    }
    return decoded as AccessTokenClaims & { iat: number; exp: number };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid or expired token');
  }
}

/** Verify a refresh token and return its claims, or throw 401. */
export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    const decoded = jwt.verify(token, requireRefreshSecret());
    if (typeof decoded !== 'object' || decoded === null) {
      throw AppError.unauthorized('Invalid refresh token');
    }
    return decoded as RefreshTokenClaims & { iat: number; exp: number };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized('Invalid or expired refresh token');
  }
}

/**
 * Convert env.JWT_ACCESS_TTL (e.g. "15m", "1h", "60s") to seconds so we can
 * report `expiresIn` in responses.
 */
export function accessTokenSeconds(): number {
  return parseDuration(env.JWT_ACCESS_TTL);
}

function parseDuration(d: string): number {
  const m = /^(\d+)\s*([smhd])?$/i.exec(d.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  switch (unit) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}
