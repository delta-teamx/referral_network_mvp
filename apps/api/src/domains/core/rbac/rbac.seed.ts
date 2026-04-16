import { PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES, type UserRole } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';

/**
 * Idempotent seeder — ensures every `PERMISSIONS` key is present in the
 * `Permission` table and every default role grant is present in
 * `RolePermission`. Called once at boot from `src/index.ts`.
 *
 * Grants that don't exist are inserted. Existing grants are left alone —
 * admins can revoke defaults per role in production, and re-seeding must
 * not silently restore them. Permissions no longer in code are NOT pruned
 * (safety rail; use an explicit admin tool for that later).
 */
export async function seedRbac(): Promise<{ permissions: number; grants: number }> {
  const descriptions = buildDescriptionMap();

  // Upsert every permission key.
  await prisma.$transaction(
    Object.values(PERMISSIONS).map((key) =>
      prisma.permission.upsert({
        where: { key },
        create: { key, description: descriptions[key] ?? key },
        update: { description: descriptions[key] ?? key },
      }),
    ),
  );

  // Insert missing role↔permission pairs.
  let grants = 0;
  for (const role of USER_ROLES) {
    const expected = ROLE_PERMISSIONS[role as UserRole];
    for (const permissionKey of expected) {
      const exists = await prisma.rolePermission.findUnique({
        where: { role_permissionKey: { role: role as UserRole, permissionKey } },
      });
      if (!exists) {
        await prisma.rolePermission.create({
          data: { role: role as UserRole, permissionKey },
        });
        grants += 1;
      }
    }
  }

  return { permissions: Object.keys(PERMISSIONS).length, grants };
}

function buildDescriptionMap(): Record<string, string> {
  return {
    [PERMISSIONS.LISTING_CREATE]: 'Create a new business listing',
    [PERMISSIONS.LISTING_UPDATE_OWN]: 'Update your own business listing',
    [PERMISSIONS.LISTING_UPDATE_ANY]: 'Update any business listing (admin)',
    [PERMISSIONS.LISTING_DELETE_OWN]: 'Delete your own business listing',
    [PERMISSIONS.LISTING_DELETE_ANY]: 'Delete any business listing (admin)',
    [PERMISSIONS.LISTING_CLAIM]: 'Claim an unclaimed business listing',
    [PERMISSIONS.LISTING_MODERATE]: 'Flag or suspend listings',
    [PERMISSIONS.REVIEW_CREATE]: 'Leave a review',
    [PERMISSIONS.REVIEW_UPDATE_OWN]: 'Update your own review',
    [PERMISSIONS.REVIEW_DELETE_OWN]: 'Delete your own review',
    [PERMISSIONS.REVIEW_MODERATE]: 'Moderate flagged reviews',
    [PERMISSIONS.CONNECTION_REQUEST]: 'Request a B2B connection',
    [PERMISSIONS.CONNECTION_RESPOND]: 'Accept or decline a B2B connection',
    [PERMISSIONS.INVITATION_SEND]: 'Invite another business to the network',
    [PERMISSIONS.REFERRAL_SEND]: 'Send a referral to another business',
    [PERMISSIONS.REFERRAL_RESPOND]: 'Accept or decline a received referral',
    [PERMISSIONS.GROUP_CREATE]: 'Create a networking group',
    [PERMISSIONS.GROUP_JOIN]: 'Join a networking group',
    [PERMISSIONS.GROUP_MANAGE_OWN]: 'Manage a group you lead',
    [PERMISSIONS.GROUP_MANAGE_ANY]: 'Manage any group (admin)',
    [PERMISSIONS.CONSUMER_LEAD_CREATE]: 'Request a consumer lead via the life-events connector',
    [PERMISSIONS.CONSUMER_LEAD_RESPOND]: 'Respond to a consumer lead as a provider',
    [PERMISSIONS.USER_READ]: 'Read user profiles (admin)',
    [PERMISSIONS.USER_MANAGE]: 'Create, suspend, or change roles on users (admin)',
    [PERMISSIONS.PLATFORM_REPORTS]: 'View platform-wide reports (admin)',
  };
}
