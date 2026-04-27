import type { User } from '@prisma/client';
import type { AuthenticatedUserDto } from '@refnet/shared';
import { prisma } from '../../../config/prisma.js';

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
  });
}

export async function toAuthenticatedUserDto(user: User): Promise<AuthenticatedUserDto> {
  const onboarding = await prisma.onboardingProgress.findUnique({
    where: { userId: user.id },
    select: { completedAt: true },
  });

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
    onboardingCompleted: onboarding?.completedAt != null,
    createdAt: user.createdAt.toISOString(),
  };
}
