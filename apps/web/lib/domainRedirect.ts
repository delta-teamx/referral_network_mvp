'use client';

import { useEffect } from 'react';
import { MARKETING_BASE_URL, isAppHost } from './domains';

/**
 * Redirects public marketing pages that are opened on the app domain
 * (dashboard.referralnova.com) over to the marketing site (referralnova.com).
 * Returns true while the redirect is happening so the caller can render nothing.
 */
export function usePublicPageRedirect(): boolean {
  const onAppDomain = isAppHost();

  useEffect(() => {
    if (onAppDomain) {
      window.location.href = `${MARKETING_BASE_URL}${window.location.pathname}`;
    }
  }, [onAppDomain]);

  return onAppDomain;
}
