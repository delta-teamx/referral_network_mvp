'use client';

import Link from 'next/link';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

export function SignupBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);

  // Only show on referralnova.com public pages
  const isVpn = typeof window !== 'undefined' &&
    (window.location.hostname === 'virtualprosnetwork.com' || window.location.hostname === 'www.virtualprosnetwork.com');
  const isAuthPage = typeof window !== 'undefined' &&
    /^\/(login|signup|verify|onboarding|dashboard|admin)/.test(window.location.pathname);
  if (user || dismissed || isVpn || isAuthPage) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Join VirtualProsNetwork</span> &mdash; AI-matched referrals for local, remote &amp; international businesses. Free to start.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="https://virtualprosnetwork.com/signup"
            className="whitespace-nowrap rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            Sign up free
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 text-gray-400 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
