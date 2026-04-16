/**
 * User roles — kept in sync with the Prisma `UserRole` enum.
 *
 * Roles are coarse-grained categories. Fine-grained authorization uses
 * the `PERMISSIONS` keys defined in `./permissions.ts`; roles just bundle
 * sets of permissions via `ROLE_PERMISSIONS`.
 */
export const USER_ROLES = [
  'CONSUMER',
  'BUSINESS_OWNER',
  'GROUP_LEADER',
  'CITY_CAPTAIN',
  'ADMIN',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
