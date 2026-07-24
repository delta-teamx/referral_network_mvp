import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * Launch mode: the email verification-code step is removed. Accounts are
 * active immediately; abuse is held back by name validation, disposable-email
 * checks and rate limits. This middleware now only asserts the caller is
 * authenticated, so re-enabling verification later is a one-line change here.
 */
export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(AppError.unauthorized());
  next();
}
