import type { SubscriptionTier } from '../constants/subscriptionTiers';
import type { UserRole } from '../constants/roles';

/** Shape returned by GET /api/v1/auth/me. Keep slim — no tokens or secrets. */
export interface AuthenticatedUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

export interface AuthTokensDto {
  /** JWT — used in `Authorization: Bearer <token>` header. */
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

export interface AuthSuccessDto {
  user: AuthenticatedUserDto;
  tokens: AuthTokensDto;
}
