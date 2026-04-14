import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

/**
 * Run a Zod schema against `req.body` (default), `req.query`, or `req.params`
 * and replace that request field with the parsed output on success. ZodError
 * is thrown through to the global errorHandler where it's translated into a
 * 400 with a `details` array.
 *
 * Usage:
 *   router.post('/signup', validate(signupSchema), handler);
 *   router.get('/things', validate(paginationSchema, 'query'), handler);
 */
export function validate<S extends ZodTypeAny>(
  schema: S,
  source: 'body' | 'query' | 'params' = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(req[source]) as z.infer<S>;
    // Re-assign the source to the typed, trimmed, defaulted shape.
    (req as unknown as Record<string, unknown>)[source] = parsed;
    next();
  };
}
