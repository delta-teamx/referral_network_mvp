'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

interface Props {
  feature: string;
  requiredTier: 'PRO' | 'PREMIUM';
  children: ReactNode;
}

const TIER_RANK: Record<string, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

export function UpgradeGate({ feature, requiredTier, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const tier = user?.subscriptionTier ?? 'FREE';
  const userRank = TIER_RANK[tier] ?? 0;
  const requiredRank = TIER_RANK[requiredTier] ?? 1;

  if (userRank >= requiredRank || user?.role === 'ADMIN') {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-20 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock size={24} className="text-primary" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-gray-900">{feature}</h3>
          <p className="mb-5 text-sm text-gray-600">
            This feature requires the {requiredTier === 'PRO' ? 'Pro ($49/mo)' : 'Premium ($149/mo)'} plan.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Upgrade to {requiredTier} →
          </Link>
        </div>
      </div>
    </div>
  );
}
