'use client';

import { useState } from 'react';
import { Check, Crown, Sparkles, Zap } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { Button } from '../../../../components/ui/Button';

const PLANS = [
  {
    tier: 'FREE',
    name: 'Free',
    price: 0,
    features: [
      '1 business profile',
      '3 AI introductions / month',
      'Join up to 2 groups',
      'Video profile upload',
      'Basic dashboard',
    ],
    icon: Sparkles,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    price: 49,
    features: [
      'Everything in Free',
      '30 AI introductions / month',
      'Up to 3 business profiles',
      'Join up to 10 groups',
      'Full analytics dashboard',
      'AI match insights',
      'In-app messaging',
      'Zoom booking',
      'Referral management',
      'My Network page',
      'Priority support',
    ],
    icon: Zap,
    featured: true,
  },
  {
    tier: 'PREMIUM',
    name: 'Premium',
    price: 149,
    features: [
      'Everything in Pro',
      'Unlimited AI introductions',
      'Up to 10 business profiles',
      'Unlimited groups',
      'Priority ranking in AI matches',
      'Dedicated account manager',
    ],
    icon: Crown,
  },
];

export default function BillingPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(tier: string) {
    if (!accessToken) return;
    setLoading(tier);
    setError(null);
    try {
      const result = await api.post<{ url: string }>(
        '/api/v1/billing/checkout',
        { tier },
        { accessToken: accessToken ?? undefined },
      );
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed');
    } finally {
      setLoading(null);
    }
  }

  const currentTier = user?.subscriptionTier ?? 'FREE';

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Billing</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Upgrade your plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          You&rsquo;re on the <span className="font-semibold text-gray-900">{currentTier}</span> plan.
          Upgrade to unlock more features.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentTier === plan.tier;
          return (
            <div
              key={plan.tier}
              className={`rounded-2xl border p-6 ${
                plan.featured
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-4 flex items-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  plan.featured ? 'bg-primary/10' : 'bg-gray-100'
                }`}>
                  <Icon size={20} className={plan.featured ? 'text-primary' : 'text-gray-500'} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{plan.name}</p>
                  {plan.featured && (
                    <span className="text-xs font-semibold text-primary">Most popular</span>
                  )}
                </div>
              </div>

              <p className="mb-4">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-500">/month</span>
              </p>

              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-center text-sm font-semibold text-gray-500">
                  Current plan
                </div>
              ) : plan.tier === 'FREE' ? null : (
                <Button
                  onClick={() => void upgrade(plan.tier)}
                  loading={loading === plan.tier}
                  className="w-full"
                >
                  Upgrade to {plan.name}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
