import type { User } from '@prisma/client';
import type { AuthenticatedUserDto } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';

/**
 * Users domain — thin wrapper around Prisma for user lookups and profile
 * shaping. No auth logic here; that lives in `domains/core/auth/`.
 */

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
  });
}

/** Project a User row to the slim DTO the frontend consumes. */
export function toAuthenticatedUserDto(user: User): AuthenticatedUserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
