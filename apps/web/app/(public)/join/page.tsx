'use client';

import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../../../lib/api';
import { APP_BASE_URL } from '../../../lib/domains';

/**
 * Short invite-link landing: referralnova.com/join/<code>.
 *
 * This is a static-export SPA route (netlify rewrites /join/* here), so the
 * code is read from the path at runtime, resolved to the referrer's id via the
 * public API, and the visitor is forwarded to the app's signup page with the
 * ?ref= attribution the backend already understands. Unknown codes fall back
 * to a plain signup so a mistyped link never dead-ends.
 */
export default function JoinRedirectPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('join');
    const code = idx >= 0 ? parts[idx + 1] : undefined;

    if (!code) {
      window.location.replace(`${APP_BASE_URL}/signup`);
      return;
    }

    const base = apiBaseUrl() || APP_BASE_URL.replace('dashboard.', 'api.');
    fetch(`${base}/api/v1/referral-tracking/resolve/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const ref: string | null = body?.data?.ref ?? null;
        const target = ref
          ? `${APP_BASE_URL}/signup?ref=${encodeURIComponent(ref)}`
          : `${APP_BASE_URL}/signup`;
        window.location.replace(target);
      })
      .catch(() => {
        // Network hiccup - still let them sign up, just without attribution.
        setFailed(true);
        window.location.replace(`${APP_BASE_URL}/signup`);
      });
  }, []);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-primary-light via-white to-blue-50 px-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-gray-700">
          {failed ? 'Taking you to sign up…' : 'Taking you to your invite…'}
        </p>
      </div>
    </main>
  );
}
