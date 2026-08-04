/**
 * Synthetic "system" user accounts. These are real rows in the User table with
 * role=ADMIN (so they stay out of the member directory, leaderboard and
 * matching), but they are NOT people - nobody logs in as them and their email
 * addresses are not real inboxes.
 *
 * Any query that lists admins in order to NOTIFY or EMAIL them must exclude
 * these, or bell pings and signup emails leak to accounts no one reads and
 * emails bounce. Use SYSTEM_ACCOUNT_EMAILS in the `NOT` clause.
 */

/** ROUL Support - the account admins speak through in a member's Messages tab. */
export const ROUL_SUPPORT_EMAIL = 'roul-support@referralnova.com';

/** Referral Nova announcements - the sender of Founder/team broadcasts. */
export const ANNOUNCER_EMAIL = 'announcements@referralnova.com';

/** Every synthetic account email. Exclude these when listing notifiable admins. */
export const SYSTEM_ACCOUNT_EMAILS = [ROUL_SUPPORT_EMAIL, ANNOUNCER_EMAIL];
