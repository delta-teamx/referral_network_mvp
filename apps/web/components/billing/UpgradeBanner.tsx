'use client';

import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';

export function UpgradeBanner() {
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.subscriptionTier !== 'FREE' || dismissed) return null;

  return (
    <div className="relative border-b border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-amber-50 px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              You&rsquo;re on the Free plan — 3 leads/month, 1 listing
            </p>
            <p className="text-xs text-gray-600">
              Upgrade to Pro for 30 leads, 3 listings, full analytics, and match insights.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/billing"
            className="whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            Upgrade now →
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
