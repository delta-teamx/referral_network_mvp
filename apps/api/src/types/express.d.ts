import type { SubscriptionTier, UserRole } from '@refnet/shared';

/**
 * Augment Express's `Request` so middleware/handlers can read the
 * authenticated user without re-fetching from the DB. `authenticate`
 * middleware (Branch 2) populates this; `authorize` consumes it.
 */
declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      email: string;
      role: UserRole;
      subscriptionTier: SubscriptionTier;
      emailVerified: boolean;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
