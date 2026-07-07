'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

/**
 * Wrap any page that should only be visible to signed-in users.
 * Shows a "Please log in" card instead of redirecting - keeps the URL
 * so they can come back after login.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  if (status === 'loading' || status === 'idle') {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <Lock size={24} className="text-primary" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Members only</h2>
          <p className="mb-6 text-sm text-gray-600">
            Sign in or create a free account to access this page.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/login"
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-primary hover:underline"
            >
              Create free account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
