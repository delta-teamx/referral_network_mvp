/**
 * Domain configuration for the Referral Nova migration.
 *
 * The product/app lives at dashboard.referralnova.com. The old
 * virtualprosnetwork.com hosts are kept in the app-host list during the
 * migration so links and redirects keep working on the old domain until it's
 * fully retired — remove them once DNS is cut over.
 *
 * Marketing site = referralnova.com (anything not in APP_HOSTS).
 */
export const APP_BASE_URL = 'https://dashboard.referralnova.com';
export const MARKETING_BASE_URL = 'https://referralnova.com';

const APP_HOSTS = [
  'dashboard.referralnova.com',
  'virtualprosnetwork.com',
  'www.virtualprosnetwork.com',
];

/** True when the current host is the product/app domain (not the marketing site). */
export function isAppHost(): boolean {
  if (typeof window === 'undefined') return false;
  return APP_HOSTS.includes(window.location.hostname);
}
