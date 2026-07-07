'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Demo "Continue with Google" landing. Used when the backend OAuth
 * start endpoint detects that GOOGLE_CLIENT_ID isn't configured and
 * redirects here instead of to real Google. Fakes a logged-in session
 * so the client demo can still show the full post-signup flow.
 */
export default function OAuthDemoPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const existingUser = useAuthStore((s) => s.user);

  useEffect(() => {
    const isReturning = !!existingUser;
    setAuth(
      {
        id: 'demo-google-user',
        email: 'demo.google@virtualprosnetwork.app',
        firstName: 'Demo',
        lastName: 'Google',
        role: 'BUSINESS_OWNER',
        subscriptionTier: 'FREE',
        emailVerified: true,
        avatarUrl: null,
      } as unknown as Parameters<typeof setAuth>[0],
      'demo-google-access-token',
      Date.now() + 900 * 1000,
    );
    router.replace(isReturning ? '/dashboard' : '/onboarding');
  }, [router, setAuth, existingUser]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-gray-600">Signing you in with Google…</p>
        <p className="mt-2 text-xs text-gray-400">(Demo mode - no real Google call is made.)</p>
      </div>
    </main>
  );
}
