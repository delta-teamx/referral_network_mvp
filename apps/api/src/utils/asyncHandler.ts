import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route handler so rejected promises flow into Express's
 * `next(err)` pipeline. Express 4 does not forward promise rejections from
 * handlers automatically; Express 5 does, but we're on 4.
 *
 * Usage:
 *   router.post('/x', asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler<
  H extends (req: Request, res: Response, next: NextFunction) => unknown,
>(handler: H): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
