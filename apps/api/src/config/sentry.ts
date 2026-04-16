import type { Application, NextFunction, Request, Response } from 'express';
import { env } from './env.js';

/**
 * Optional Sentry integration. Zero-cost when SENTRY_DSN isn't set: the
 * handlers below are no-ops.
 *
 *   - `initSentry(app)` is called right after `app = express()` so the
 *     request handler is the first middleware in the chain.
 *   - `sentryErrorHandler` is inserted before our own `errorHandler` so
 *     Sentry sees 4xx/5xx before we format the JSON envelope.
 *
 * SDK is lazy-imported. That keeps `@sentry/node` an optional dependency —
 * the API boots without it installed.
 */

type ExpressRequestHandler = (req: Request, res: Response, next: NextFunction) => void;
type ExpressErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

interface SentryBundle {
  requestHandler: ExpressRequestHandler;
  errorHandler: ExpressErrorHandler;
}

let bundle: SentryBundle | null = null;

export async function initSentry(app: Application): Promise<void> {
  if (!env.SENTRY_DSN) return;

  try {
    // @ts-expect-error — @sentry/node is optional.
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0.0,
    });

    const requestHandler: ExpressRequestHandler =
      typeof Sentry.Handlers?.requestHandler === 'function'
        ? Sentry.Handlers.requestHandler()
        : (_req, _res, next) => next();
    const errorHandler: ExpressErrorHandler =
      typeof Sentry.Handlers?.errorHandler === 'function'
        ? Sentry.Handlers.errorHandler()
        : (_err, _req, _res, next) => next(_err);

    bundle = { requestHandler, errorHandler };
    app.use(requestHandler);

    // eslint-disable-next-line no-console
    console.log('[sentry] initialized');
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[sentry] SENTRY_DSN set but @sentry/node not installed — skipping');
  }
}

export const sentryErrorHandler: ExpressErrorHandler = (err, req, res, next) => {
  if (bundle) return bundle.errorHandler(err, req, res, next);
  return next(err);
};
