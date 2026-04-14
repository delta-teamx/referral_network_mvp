import { PERMISSIONS, ROLE_PERMISSIONS, type Permission, type UserRole } from '@refnet/shared';

/**
 * RBAC service — the single place authorization decisions happen in-process.
 *
 * Branch 1 serves answers purely from the static `ROLE_PERMISSIONS` map in
 * `@refnet/shared` so the authorize middleware can be wired without a DB.
 *
 * Branch 2 will seed `Permission` + `RolePermission` tables from that map
 * and swap this service to read from DB (with an in-memory cache warmed
 * at boot + invalidated on admin mutations). The `hasPermission` signature
 * stays stable, so call sites don't change.
 */

const rolePermissionCache: Record<UserRole, Set<Permission>> = {
  CONSUMER: new Set(ROLE_PERMISSIONS.CONSUMER),
  BUSINESS_OWNER: new Set(ROLE_PERMISSIONS.BUSINESS_OWNER),
  GROUP_LEADER: new Set(ROLE_PERMISSIONS.GROUP_LEADER),
  CITY_CAPTAIN: new Set(ROLE_PERMISSIONS.CITY_CAPTAIN),
  ADMIN: new Set(ROLE_PERMISSIONS.ADMIN),
};

/** True if the given role is granted the given permission. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissionCache[role]?.has(permission) ?? false;
}

/** True if the role has every listed permission. */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/** True if the role has at least one of the listed permissions. */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** All permissions granted to a role (stable-ordered array). */
export function permissionsForRole(role: UserRole): Permission[] {
  return Array.from(rolePermissionCache[role] ?? []);
}

/**
 * Re-exported for ergonomic use at call sites:
 *   authorize(PERMISSIONS.LISTING_CREATE)
 */
export { PERMISSIONS };
