'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

function Inner() {
  const params = useSearchParams();
  const tier = params.get('tier') as 'PRO' | 'PREMIUM' | null;
  const demo = params.get('demo') === '1';
  const accessToken = useAuthStore((s) => s.accessToken);
  const [finalised, setFinalised] = useState(false);

  useEffect(() => {
    if (!demo || !tier || !accessToken) {
      setFinalised(true);
      return;
    }
    let cancelled = false;
    async function finalise() {
      try {
        await api.post(
          '/api/v1/billing/finalise-demo',
          { tier },
          { accessToken: accessToken ?? undefined },
        );
      } finally {
        if (!cancelled) setFinalised(true);
      }
    }
    void finalise();
    return () => {
      cancelled = true;
    };
  }, [demo, tier, accessToken]);

  return (
    <main className="flex min-h-screen items-center bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-lg rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-xl"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <Check size={32} />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Welcome to {tier ?? 'your plan'}!</h1>
        <p className="mb-6 text-sm text-gray-600">
          {finalised
            ? 'Your account is upgraded. Every lead cap and feature gate just unlocked.'
            : 'Finalising your upgrade…'}
        </p>
        {demo && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <Sparkles size={12} /> Demo checkout (no real charge)
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Go to dashboard →
          </Link>
          <Link href="/pricing" className="text-xs text-gray-500 hover:text-primary">
            View plans
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50" />}
    >
      <Inner />
    </Suspense>
  );
}
