'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AuthenticatedUserDto } from '@refnet/shared';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Google OAuth post-redirect landing. The backend /api/v1/auth/oauth/google/callback
 * 302s here with #access_token=...&expires_in=...&user_id=... after it's
 * set the refresh cookie and issued the access token. We:
 *
 *   1. Parse the fragment
 *   2. Call GET /api/v1/auth/me to rehydrate the full user profile
 *   3. Seed the Zustand auth store
 *   4. Redirect to /dashboard
 *
 * Failure cases (bad/expired token, user revoked access) bounce back to
 * /login with an error banner.
 */
export default function OAuthCompletePage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finalise() {
      const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = frag.get('access_token');
      const expiresIn = Number(frag.get('expires_in') ?? 900);
      if (!accessToken) {
        setError('Missing access token from Google. Please try signing in again.');
        return;
      }
      try {
        const me = await api.get<AuthenticatedUserDto>('/api/v1/auth/me', { accessToken });
        setAuth(me, accessToken, Date.now() + expiresIn * 1000);
        router.replace('/dashboard');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Sign-in failed');
      }
    }
    void finalise();
  }, [router, setAuth]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="mb-2 font-semibold text-danger">Sign-in failed</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-gray-600">Finishing sign-in…</p>
          </>
        )}
      </div>
    </main>
  );
}
