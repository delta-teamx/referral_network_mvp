import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * In-memory fixed-window rate limiter. Zero dependencies, good-enough for a
 * single-process deployment; swap to `rate-limiter-flexible` + Redis when we
 * run multiple API instances behind a load balancer.
 *
 * Usage:
 *   router.use(rateLimit({ windowMs: 60_000, max: 30, key: 'auth' }));
 *
 * Limits are per (route-key, client-IP). Exceeding the limit returns 429
 * with `Retry-After` + a JSON envelope matching the rest of the API.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

interface Options {
  /** Time window in ms. */
  windowMs: number;
  /** Max requests per key+IP within the window. */
  max: number;
  /** Namespace so different middlewares don't share buckets. */
  key: string;
  /** Bypass the limit entirely (e.g. health checks in tests). */
  skip?: (req: Request) => boolean;
}

const stores = new Map<string, Map<string, Bucket>>();

function getStore(namespace: string): Map<string, Bucket> {
  let s = stores.get(namespace);
  if (!s) {
    s = new Map();
    stores.set(namespace, s);
  }
  return s;
}

function extractIp(req: Request): string {
  // Trust `X-Forwarded-For` only behind a known proxy — in production Express
  // should be configured with `app.set('trust proxy', 1)` before entries in
  // this header are honoured. Fall back to socket.remoteAddress.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim() ?? 'unknown';
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function rateLimit(opts: Options) {
  const store = getStore(opts.key);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (opts.skip?.(req)) return next();

    const ip = extractIp(req);
    const now = Date.now();
    const bucket = store.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + opts.windowMs });
      res.setHeader('X-RateLimit-Limit', String(opts.max));
      res.setHeader('X-RateLimit-Remaining', String(opts.max - 1));
      return next();
    }

    if (bucket.count >= opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(opts.max));
      res.setHeader('X-RateLimit-Remaining', '0');
      return next(AppError.tooMany(`Rate limit exceeded. Retry in ${retryAfterSec}s.`));
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.max - bucket.count)));
    next();
  };
}

/** Aggressive gate on auth endpoints to slow down credential stuffing. */
export const authRateLimit = rateLimit({ windowMs: 60_000, max: 10, key: 'auth' });

/** Tight gate on signup to raise the cost of registration spam. */
export const signupRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: 'signup' });

/** Catch-all for any mutation endpoint (POST/PATCH/DELETE). */
export const mutationRateLimit = rateLimit({ windowMs: 60_000, max: 60, key: 'mutations' });
