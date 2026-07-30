/**
 * Domain configuration for Referral Nova.
 *
 * The product/app lives at dashboard.referralnova.com.
 * Marketing site = referralnova.com (anything not in APP_HOSTS).
 */
export const APP_BASE_URL = 'https://dashboard.referralnova.com';
export const MARKETING_BASE_URL = 'https://referralnova.com';

/**
 * Canonical auth entry points. Login/signup always live on the app domain
 * (dashboard.referralnova.com), so every marketing CTA points here rather than
 * at a relative path that would strand the user on the marketing origin.
 */
export const SIGNUP_URL = `${APP_BASE_URL}/signup`;
export const LOGIN_URL = `${APP_BASE_URL}/login`;

const APP_HOSTS = [
  'dashboard.referralnova.com',
];

/** True when the current host is the product/app domain (not the marketing site). */
export function isAppHost(): boolean {
  if (typeof window === 'undefined') return false;
  return APP_HOSTS.includes(window.location.hostname);
}
