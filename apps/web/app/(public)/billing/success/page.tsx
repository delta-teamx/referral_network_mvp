'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

function Inner() {
  const params = useSearchParams();
  const tier = params.get('tier') as 'PRO' | 'PREMIUM' | null;
  const sessionId = params.get('session_id');
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tier || !accessToken) {
      setReady(true);
      return;
    }
    async function finalise() {
      try {
        await api.post('/api/v1/billing/finalise-demo', { tier }, { accessToken: accessToken ?? undefined });
      } finally {
        await hydrate();
        setReady(true);
      }
    }
    void finalise();
  }, [tier, accessToken, hydrate]);

  return (
    <main className="flex min-h-[60vh] items-center bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
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
          {ready
            ? 'Your account is upgraded. All features are now unlocked.'
            : 'Finalising your upgrade…'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Go to dashboard →
        </Link>
      </motion.div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50" />}>
      <Inner />
    </Suspense>
  );
}
