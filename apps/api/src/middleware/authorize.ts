import type { RequestHandler } from 'express';
import type { Permission } from '@refnet/shared';
import { hasAllPermissions, hasAnyPermission } from '../domains/core/rbac/rbac.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * `authorize(...permissions)` — gate a route on one or more permission keys.
 *
 * Usage:
 *   router.post('/listings', authenticate, authorize(PERMISSIONS.LISTING_CREATE), create);
 *   router.post('/admin/x',  authenticate, authorize(PERMISSIONS.USER_MANAGE), handler);
 *
 * Default semantics: **all** listed permissions must be satisfied (AND).
 * Pass `{ mode: 'any' }` for OR semantics when any single permission
 * suffices.
 *
 * Expects `req.user` to have been populated by `authenticate` (Branch 2).
 * If it hasn't, returns 401 — so this middleware is safe to compose even
 * before auth lands; unauthenticated routes simply won't use it.
 */
export interface AuthorizeOptions {
  mode?: 'all' | 'any';
}

export function authorize(
  ...args: [...Permission[]] | [...Permission[], AuthorizeOptions]
): RequestHandler {
  // Trailing options object is optional.
  const last = args[args.length - 1];
  const options: AuthorizeOptions =
    typeof last === 'object' && last !== null && !isPermissionString(last)
      ? (last as AuthorizeOptions)
      : {};
  const permissions = (options === last ? args.slice(0, -1) : args) as Permission[];

  const check = options.mode === 'any' ? hasAnyPermission : hasAllPermissions;

  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }
    if (permissions.length === 0 || check(req.user.role, permissions)) {
      return next();
    }
    next(AppError.forbidden('Insufficient permissions'));
  };
}

function isPermissionString(value: unknown): value is Permission {
  return typeof value === 'string';
}
