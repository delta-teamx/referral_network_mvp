/**
 * Common disposable / throwaway email domains. Not exhaustive — the real
 * line of defence is the MX-lookup check on the server. This list just
 * rejects the most egregious offenders client-side for fast UX feedback.
 *
 * Update periodically from upstream lists like disposable-email-domains
 * on GitHub. Kept static here so it doesn't require a network call.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'mailinator.com',
  'mailinator.net',
  'temp-mail.org',
  'tempmail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.net',
  'sharklasers.com',
  'spam4.me',
  'getnada.com',
  'trashmail.com',
  'maildrop.cc',
  'fakeinbox.com',
  'dispostable.com',
  'mytrashmail.com',
  'mintemail.com',
  'emailondeck.com',
  'mailsac.com',
  'moakt.com',
  'harakirimail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
