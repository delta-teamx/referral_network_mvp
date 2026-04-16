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
