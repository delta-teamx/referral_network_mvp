'use client';

import Link from 'next/link';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface BillingStatus {
  tier: string;
  pastDue: boolean;
  pausedTier?: string;
  payUrl?: string | null;
}

/**
 * Top-of-dashboard billing strip.
 *
 * - Payment failed (Stripe says past_due/unpaid): red PAUSED alert with a
 *   direct link to pay the dues - not dismissible, this one matters.
 * - Otherwise, FREE members get the regular upgrade nudge (dismissible).
 */
export function UpgradeBanner() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [dismissed, setDismissed] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    void api
      .get<BillingStatus>('/api/v1/billing/status', { accessToken })
      .then((s) => {
        if (!cancelled) setBilling(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken, user]);

  if (!user) return null;

  // ── Paused: unpaid dues ─────────────────────────────────────────────
  if (billing?.pastDue) {
    return (
      <div className="border-b border-danger/30 bg-danger/5 px-6 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <AlertTriangle size={16} className="text-danger" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Your {billing.pausedTier ?? 'paid'} plan is paused - last payment failed
              </p>
              <p className="text-xs text-gray-600">
                Paid features are on hold. Pay the outstanding invoice and everything resumes
                instantly.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {billing.payUrl ? (
              <a
                href={billing.payUrl}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap rounded-full bg-danger px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-danger/90"
              >
                Pay dues now →
              </a>
            ) : (
              <Link
                href="/dashboard/billing"
                className="whitespace-nowrap rounded-full bg-danger px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-danger/90"
              >
                Open billing →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Regular FREE upsell ─────────────────────────────────────────────
  if (user.subscriptionTier !== 'FREE' || dismissed) return null;

  return (
    <div className="relative border-b border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-amber-50 px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Zap size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              You&rsquo;re on the Free plan - 3 leads/month, 1 listing
            </p>
            <p className="text-xs text-gray-600">
              Upgrade to Pro for 30 leads, 3 listings, full analytics, and match insights.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/billing"
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
