/**
 * Typed catalogue of domain events published by the backend.
 *
 * The API's `EventBus` consumes these keys and the matching payload
 * shapes. Subscribers (email/SMS senders, analytics collectors, lead
 * distribution, strength-score recompute) register against keys from
 * this map so the TypeScript compiler catches drift.
 *
 * Event naming convention: `<aggregate>.<past_tense_verb>`
 * Payloads are intentionally minimal — IDs only, subscribers fetch
 * additional data as needed. This keeps events small and cacheable.
 */
export interface DomainEventMap {
  // Core / auth
  'user.signed_up': { userId: string; email: string; role: string };
  'user.email_verified': { userId: string };
  'user.logged_in': { userId: string };

  // Onboarding
  'onboarding.step_completed': { userId: string; step: string };
  'onboarding.completed': { userId: string };

  // Directory
  'listing.created': { listingId: string; userId: string };
  'listing.updated': { listingId: string };
  'listing.claimed': { listingId: string; userId: string };
  'review.created': { reviewId: string; listingId: string; rating: number };

  // Consumer leads (Life Events Connector)
  'consumer_lead.created': { leadId: string; listingId: string; eventType: string };
  'consumer_lead.contacted': { leadId: string };
  'consumer_lead.converted': { leadId: string };

  // Business network (B2B)
  'business_connection.requested': {
    connectionId: string;
    initiatorId: string;
    targetId: string;
  };
  'business_connection.accepted': { connectionId: string };
  'business_connection.declined': { connectionId: string };

  'business_invitation.sent': { invitationId: string; recipientEmail: string };
  'business_invitation.accepted': { invitationId: string; newUserId: string };
  'business_invitation.expired': { invitationId: string };

  'referral.sent': { referralId: string; senderId: string; receiverId: string };
  'referral.accepted': { referralId: string };
  'referral.converted': { referralId: string };
  'referral.declined': { referralId: string };

  // Groups
  'group.created': { groupId: string; creatorId: string };
  'group.member_joined': { groupId: string; userId: string };
  'group.member_left': { groupId: string; userId: string };

  // Matching
  'matching.completed': {
    requestId: string;
    eventType: string;
    resultCount: number;
  };

  // AI-suggested introductions
  'intro.accepted': {
    introId: string;
    senderId: string;
    targetId: string;
  };
  'intro.auto_booking_skipped': {
    introId: string;
    hostUserId: string;
    guestUserId: string;
    reason: 'no_overlap' | 'no_availability' | 'error';
  };

  // Payments
  'subscription.activated': { userId: string; tier: string };
  'subscription.canceled': { userId: string };
  'subscription.payment_failed': { userId: string };

  // Bookings
  'booking.created': { bookingId: string; hostId: string; guestId: string };
  'booking.canceled': { bookingId: string };
  'booking.reminder_due': { bookingId: string };

  // Networking events
  'networking_event.created': { eventId: string };
  'networking_event.registered': { eventId: string; userId: string };
  'networking_event.starting_soon': { eventId: string };

  // Admin moderation
  'admin.user_role_changed': { adminId: string; userId: string; role: string };
  'admin.user_suspended': { adminId: string; userId: string; reason: string };
  'admin.listing_approved': { adminId: string; listingId: string };
  'admin.listing_rejected': { adminId: string; listingId: string; reason: string };
  'admin.listing_featured': { adminId: string; listingId: string; featured: boolean };
  'admin.group_archived': { adminId: string; groupId: string };
  'admin.user_impersonated': { adminId: string; targetUserId: string };

  // Matchmaking pods
  'matchmaking.pod_created': { podId: string; memberCount: number; scheduledAt: string };
  'matchmaking.feedback_submitted': { podId: string; userId: string; rating: number };

  // Referral tracking
  'referral_tracking.signup': { referrerUserId: string; inviteeUserId: string };
  'referral_tracking.reward_granted': { referrerUserId: string; inviteeUserId: string; tier: string; rewardMonths: number };
}

export type DomainEventType = keyof DomainEventMap;
