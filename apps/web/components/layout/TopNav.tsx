'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../ui/Button';
import { NotificationBell } from './NotificationBell';

/**
 * Minimal top-nav. Calls `hydrate()` once on mount so a hard refresh
 * restores the session via the HTTP-only refresh cookie.
 */
export function TopNav() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (status === 'idle') {
      void hydrate();
    }
  }, [status, hydrate]);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-sm font-semibold text-primary">
          VirtualProsNetwork
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/events"
            className="hidden rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 sm:inline"
          >
            Events
          </Link>
          <Link
            href="/search"
            className="hidden rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 sm:inline"
          >
            Directory
          </Link>
          {status === 'authenticated' && user ? (
            <>
              <NotificationBell />
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Dashboard
              </Link>
              <span className="hidden text-sm text-gray-600 sm:inline">Hi, {user.firstName}</span>
              <Button variant="ghost" onClick={() => void logout()} className="px-3 py-1.5">
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
