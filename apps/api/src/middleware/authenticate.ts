import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * `authenticate` — parses the `Authorization: Bearer <token>` header, verifies
 * the JWT, and populates `req.user`. Throws 401 on any failure.
 *
 * Does not hit the DB — claims in the JWT are trusted until the access token
 * expires (15 min by default). Compromised accounts are handled by refresh-
 * token revocation in Branch 4.
 *
 * Usage:
 *   router.get('/me', authenticate, handler);
 *   router.post('/listings', authenticate, authorize(PERMISSIONS.LISTING_CREATE), handler);
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication required'));
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(AppError.unauthorized('Authentication required'));
  }
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      subscriptionTier: claims.tier,
      emailVerified: claims.ev === true,
    };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * `optionalAuthenticate` — populates `req.user` if a valid token is present,
 * but does not reject the request otherwise. Handy for routes that tailor
 * content for signed-in users but don't require auth (homepage, public
 * listing pages).
 */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.slice('Bearer '.length).trim();
  if (!token) return next();
  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      subscriptionTier: claims.tier,
      emailVerified: claims.ev === true,
    };
  } catch {
    // swallow — route still runs, just anonymously
  }
  next();
};
