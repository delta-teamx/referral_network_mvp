'use client';

import { useEffect } from 'react';

/**
 * Redirects public marketing pages from virtualprosnetwork.com to referralnova.com.
 * Returns true if redirect is happening (caller should return null).
 */
export function usePublicPageRedirect(): boolean {
  const isVpn =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'virtualprosnetwork.com' ||
      window.location.hostname === 'www.virtualprosnetwork.com');

  useEffect(() => {
    if (isVpn) {
      window.location.href = `https://referralnova.com${window.location.pathname}`;
    }
  }, [isVpn]);

  return isVpn;
}
