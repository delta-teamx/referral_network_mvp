'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

interface Plan {
  tier: 'FREE' | 'PRO' | 'PREMIUM';
  name: string;
  pricePerMonthCents: number;
  maxLeadsPerMonth: number | null;
  maxListings: number | null;
  prioritizedInRanking: boolean;
  canSeeRankingDetails: boolean;
}

const PLAN_FEATURES: Record<Plan['tier'], string[]> = {
  FREE: [
    '1 business listing',
    'Up to 3 qualified leads per month',
    'Join up to 2 networking groups',
    'Send referrals + invitations',
    'Trust score + review collection',
  ],
  PRO: [
    'Up to 3 listings',
    '30 qualified leads per month',
    'Join up to 10 networking groups',
    'See ranking breakdown on every match',
    'Verified badge + analytics',
  ],
  PREMIUM: [
    'Up to 10 listings (multi-location)',
    'Unlimited qualified leads',
    'Unlimited group memberships',
    'Priority placement in matching',
    'Dedicated account manager',
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<Plan['tier'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Plan[]>('/api/v1/billing/plans');
        if (!cancelled) setPlans(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function upgrade(tier: 'PRO' | 'PREMIUM') {
    if (!user) {
      router.push(`/signup?next=/pricing&upgrade=${tier}`);
      return;
    }
    setCheckingOut(tier);
    try {
      const res = await api.post<{ url: string; demo: boolean }>(
        '/api/v1/billing/checkout',
        { tier },
        { accessToken: accessToken ?? undefined },
      );
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed');
    } finally {
      setCheckingOut(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-primary-light/30 to-amber-50">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mt-2 text-4xl font-bold text-gray-900">
            Start free. Upgrade when referrals start rolling in.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            No long-term contracts, no surprise fees. Every plan includes trust-score signals,
            verified badging, and the full network.
          </p>
        </div>

        {error && (
          <p className="mx-auto mb-6 max-w-md rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-6 md:grid-cols-3"
        >
          {(loading ? defaultPlans : plans).map((plan) => {
            const isRecommended = plan.tier === 'PRO';
            const features = PLAN_FEATURES[plan.tier];
            return (
              <motion.div
                key={plan.tier}
                variants={fadeInUp}
                className={`relative rounded-3xl border bg-white p-8 shadow-sm ${
                  isRecommended
                    ? 'border-primary shadow-xl ring-2 ring-primary'
                    : 'border-gray-200'
                }`}
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-md">
                    <Sparkles size={12} /> Most popular
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                  {plan.name}
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">
                    ${(plan.pricePerMonthCents / 100).toFixed(0)}
                  </span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <ul className="my-6 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check size={14} className="mt-0.5 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.tier === 'FREE' ? (
                  <Link
                    href={user ? '/dashboard' : '/signup'}
                    className="block w-full rounded-full border border-gray-200 bg-white py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
                  >
                    {user ? 'Current plan' : 'Start free'}
                  </Link>
                ) : (
                  <button
                    onClick={() => void upgrade(plan.tier as 'PRO' | 'PREMIUM')}
                    disabled={checkingOut === plan.tier}
                    className={`block w-full rounded-full py-2.5 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isRecommended
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {checkingOut === plan.tier ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <p className="mt-10 text-center text-xs text-gray-500">
          Prices in USD. Cancel anytime. Billing handled securely by Stripe.
        </p>
      </section>
    </main>
  );
}

const defaultPlans: Plan[] = [
  {
    tier: 'FREE',
    name: 'Free',
    pricePerMonthCents: 0,
    maxLeadsPerMonth: 3,
    maxListings: 1,
    prioritizedInRanking: false,
    canSeeRankingDetails: false,
  },
  {
    tier: 'PRO',
    name: 'Pro',
    pricePerMonthCents: 4900,
    maxLeadsPerMonth: 30,
    maxListings: 3,
    prioritizedInRanking: false,
    canSeeRankingDetails: true,
  },
  {
    tier: 'PREMIUM',
    name: 'Premium',
    pricePerMonthCents: 14900,
    maxLeadsPerMonth: null,
    maxListings: 10,
    prioritizedInRanking: true,
    canSeeRankingDetails: true,
  },
];
