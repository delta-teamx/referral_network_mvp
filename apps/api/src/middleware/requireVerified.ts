import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(AppError.unauthorized());
  if (!req.user.emailVerified) {
    return next(
      AppError.forbidden(
        'Please verify your email before using this feature. Check your inbox for a verification link.',
        'auth/email_not_verified',
      ),
    );
  }
  next();
}
