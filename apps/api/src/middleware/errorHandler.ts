import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/**
 * Global error handler. Coerces every thrown error into the canonical
 * ApiResponse shape so clients get a predictable envelope on failure.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const body: ApiResponse = {
      success: false,
      error: 'Validation failed',
      details: err.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        message: issue.message,
      })),
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    const body: ApiResponse = { success: false, error: err.message };
    res.status(err.statusCode).json(body);
    return;
  }

  // Known Prisma request errors → clean 4xx instead of a raw 500. Duck-typed by
  // the `Pxxxx` code so we don't couple the handler to the Prisma runtime types.
  const prismaCode =
    err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : undefined;
  if (prismaCode && /^P\d{4}$/.test(prismaCode)) {
    const map: Record<string, { status: number; message: string }> = {
      P2025: { status: 404, message: 'The requested record was not found.' },
      P2002: { status: 409, message: 'That already exists.' },
      P2003: { status: 400, message: 'Related record not found.' },
      P2000: { status: 400, message: 'A provided value is invalid.' },
      P2006: { status: 400, message: 'A provided value is invalid.' },
      P2011: { status: 400, message: 'A required value is missing.' },
    };
    const mapped = map[prismaCode];
    if (mapped) {
      // eslint-disable-next-line no-console
      console.warn(`[prisma] ${prismaCode} → ${mapped.status}`);
      res.status(mapped.status).json({ success: false, error: mapped.message });
      return;
    }
  }

  // Unknown error — log, return generic 500. Do not leak stack traces in prod.
  // eslint-disable-next-line no-console
  console.error('[unhandled]', err);
  const body: ApiResponse = {
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : String(err),
  };
  res.status(500).json(body);
};

/** Catch-all for unmatched routes. Runs just before errorHandler. */
export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiResponse = { success: false, error: `Route not found: ${req.method} ${req.path}` };
  res.status(404).json(body);
};
