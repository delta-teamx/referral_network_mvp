import type { UserRole } from './roles';

/**
 * Canonical permission registry. Every authorization check in the API
 * resolves to one of these keys via the `authorize(...)` middleware.
 *
 * Naming convention: `<resource>:<action>[:<scope>]`
 *   - `:own` scope means "only on records the actor owns".
 *   - `:any` scope means "on any record" (typically admin/moderator).
 *
 * Owners shouldn't need an explicit `:own` permission for trivial reads
 * of their own records — those are enforced by the service-layer query
 * filters. `:own` permissions exist where the action is non-trivial
 * (mutate/delete) and we want auditability.
 */
export const PERMISSIONS = {
  // Listings
  LISTING_CREATE: 'listing:create',
  LISTING_UPDATE_OWN: 'listing:update:own',
  LISTING_UPDATE_ANY: 'listing:update:any',
  LISTING_DELETE_OWN: 'listing:delete:own',
  LISTING_DELETE_ANY: 'listing:delete:any',
  LISTING_CLAIM: 'listing:claim',
  LISTING_MODERATE: 'listing:moderate',

  // Reviews
  REVIEW_CREATE: 'review:create',
  REVIEW_UPDATE_OWN: 'review:update:own',
  REVIEW_DELETE_OWN: 'review:delete:own',
  REVIEW_MODERATE: 'review:moderate',

  // Business network (B2B)
  CONNECTION_REQUEST: 'connection:request',
  CONNECTION_RESPOND: 'connection:respond',
  INVITATION_SEND: 'invitation:send',
  REFERRAL_SEND: 'referral:send',
  REFERRAL_RESPOND: 'referral:respond',

  // Groups
  GROUP_CREATE: 'group:create',
  GROUP_JOIN: 'group:join',
  GROUP_MANAGE_OWN: 'group:manage:own', // leader/co-leader of that group
  GROUP_MANAGE_ANY: 'group:manage:any', // admin

  // Consumer-side actions
  CONSUMER_LEAD_CREATE: 'consumer_lead:create',
  CONSUMER_LEAD_RESPOND: 'consumer_lead:respond', // provider responding to a lead

  // Admin / moderation
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
  PLATFORM_REPORTS: 'platform:reports',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as readonly Permission[];

/**
 * Default role → permission mapping. Persisted to DB on first boot so
 * admins can audit and customize without code changes.
 *
 * Inheritance is explicit (no auto-cascade) — easier to reason about and
 * lets us deviate per-role without surprise.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  CONSUMER: [
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_UPDATE_OWN,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.CONSUMER_LEAD_CREATE,
    PERMISSIONS.GROUP_JOIN,
  ],

  BUSINESS_OWNER: [
    PERMISSIONS.LISTING_CREATE,
    PERMISSIONS.LISTING_UPDATE_OWN,
    PERMISSIONS.LISTING_DELETE_OWN,
    PERMISSIONS.LISTING_CLAIM,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_UPDATE_OWN,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.CONNECTION_REQUEST,
    PERMISSIONS.CONNECTION_RESPOND,
    PERMISSIONS.INVITATION_SEND,
    PERMISSIONS.REFERRAL_SEND,
    PERMISSIONS.REFERRAL_RESPOND,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_JOIN,
    PERMISSIONS.CONSUMER_LEAD_RESPOND,
  ],

  GROUP_LEADER: [
    // Inherits BUSINESS_OWNER's set, plus group management within their group.
    PERMISSIONS.LISTING_CREATE,
    PERMISSIONS.LISTING_UPDATE_OWN,
    PERMISSIONS.LISTING_DELETE_OWN,
    PERMISSIONS.LISTING_CLAIM,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_UPDATE_OWN,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.CONNECTION_REQUEST,
    PERMISSIONS.CONNECTION_RESPOND,
    PERMISSIONS.INVITATION_SEND,
    PERMISSIONS.REFERRAL_SEND,
    PERMISSIONS.REFERRAL_RESPOND,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_JOIN,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.CONSUMER_LEAD_RESPOND,
  ],

  CITY_CAPTAIN: [
    // Regional coordinator — broad read access plus moderation in their city.
    PERMISSIONS.LISTING_CREATE,
    PERMISSIONS.LISTING_UPDATE_OWN,
    PERMISSIONS.LISTING_DELETE_OWN,
    PERMISSIONS.LISTING_CLAIM,
    PERMISSIONS.LISTING_MODERATE,
    PERMISSIONS.REVIEW_CREATE,
    PERMISSIONS.REVIEW_UPDATE_OWN,
    PERMISSIONS.REVIEW_DELETE_OWN,
    PERMISSIONS.REVIEW_MODERATE,
    PERMISSIONS.CONNECTION_REQUEST,
    PERMISSIONS.CONNECTION_RESPOND,
    PERMISSIONS.INVITATION_SEND,
    PERMISSIONS.REFERRAL_SEND,
    PERMISSIONS.REFERRAL_RESPOND,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_JOIN,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.CONSUMER_LEAD_RESPOND,
    PERMISSIONS.USER_READ,
  ],

  ADMIN: ALL_PERMISSIONS,
};
