'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { isDemoMode } from '../../lib/api';

/**
 * Renders a small banner across the top of the page when the app is running
 * without a live backend. Tells the viewer that writes won't persist and gives
 * them a way to dismiss it.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (!isDemoMode() || dismissed) return null;

  return (
    <div className="bg-amber-50 text-amber-900 border-b border-amber-200">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-xs">
        <span className="inline-flex items-center rounded-full bg-amber-200/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
          Preview
        </span>
        <p className="flex-1 leading-snug">
          You&rsquo;re viewing a frontend-only preview with sample data. Sign-ups, reviews, and
          referrals look real but won&rsquo;t persist. Connect the live backend to enable the full
          experience.
        </p>
        <button
          aria-label="Dismiss preview banner"
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-amber-100"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
