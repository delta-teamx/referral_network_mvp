import { randomBytes, createHash } from 'node:crypto';

/**
 * Cryptographically-random URL-safe token. Default 32 bytes = 256 bits of
 * entropy, base64url-encoded to 43 chars.
 *
 * Used for:
 *   - refresh tokens (stored as SHA-256 hash)
 *   - email verification tokens
 *   - password reset tokens
 *   - invitation tokens
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 hash of a token — stored in DB so a DB leak doesn't hand over
 * valid refresh/reset tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
