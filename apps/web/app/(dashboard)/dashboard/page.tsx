'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Eye,
  Inbox,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { AiFeed } from './AiFeed';

type Tab = 'ai' | 'metrics';

interface Metrics {
  listings: Array<{
    id: string;
    slug: string;
    name: string;
    avgRating: string | number;
    reviewCount: number;
    trustScore: string | number;
    viewCount: number;
    isVerified: boolean;
    status: string;
  }>;
  totals: {
    listings: number;
    views: number;
    leadsTotal: number;
    leadsPending: number;
    leadsContacted: number;
    leadsConverted: number;
    referralsReceived: number;
    referralsConverted: number;
    introRequests?: number;
    callsBooked?: number;
    messages?: number;
    avgRating: number;
    avgTrustScore: number;
  };
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('ai');

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your AI-powered referral hub - suggested introductions and business metrics in one place.
        </p>
      </header>

      <div className="mb-5 flex gap-2">
        <TabButton
          active={tab === 'ai'}
          icon={Sparkles}
          label="AI Suggestions"
          onClick={() => setTab('ai')}
        />
        <TabButton
          active={tab === 'metrics'}
          icon={TrendingUp}
          label="Business Metrics"
          onClick={() => setTab('metrics')}
        />
      </div>

      {tab === 'ai' ? <AiFeed /> : <MetricsPanel />}
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition ${
        active
          ? 'bg-primary text-white'
          : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function MetricsPanel() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const m = await api.get<Metrics>('/api/v1/dashboard/metrics', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setMetrics(m);
      } catch {
        if (!cancelled) setMetricsError('Could not load metrics. Try refreshing the page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (metricsError) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center">
        <p className="text-sm text-danger">{metricsError}</p>
      </div>
    );
  }

  if (loading || !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white shadow-sm" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Intro requests', value: metrics.totals.introRequests ?? 0, icon: Sparkles, color: 'text-primary' },
    { label: 'Calls booked', value: metrics.totals.callsBooked ?? 0, icon: UserCheck, color: 'text-blue-600' },
    { label: 'Messages', value: metrics.totals.messages ?? 0, icon: Inbox, color: 'text-cyan-600' },
    { label: 'Leads received', value: metrics.totals.leadsTotal, icon: Inbox, color: 'text-emerald-600' },
    { label: 'Referrals received', value: metrics.totals.referralsReceived, icon: Activity, color: 'text-orange-600' },
    { label: 'Referrals converted', value: metrics.totals.referralsConverted, icon: ArrowUpRight, color: 'text-amber-600' },
    { label: 'Avg rating', value: metrics.totals.avgRating.toFixed(1), icon: Star, color: 'text-yellow-500' },
    { label: 'Trust score', value: metrics.totals.avgTrustScore.toFixed(1), icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              variants={fadeInUp}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500">
                <Icon size={14} className={s.color} />
                {s.label}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {metrics.listings.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">Your listings</h3>
          <ul className="space-y-2">
            {metrics.listings.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/listing/${l.slug}`}
                    className="font-medium text-gray-900 hover:text-primary"
                  >
                    {l.name}
                  </Link>
                  <span className="ml-2 text-xs text-gray-400">{l.status}</span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="text-amber-400" />
                    {Number(l.avgRating).toFixed(1)} ({l.reviewCount})
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp size={12} className="text-primary" />
                    Trust {Number(l.trustScore).toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} /> {l.viewCount}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/dashboard/analytics" className="text-sm text-primary hover:underline">
          View detailed analytics →
        </Link>
        <Link href="/dashboard/leads" className="text-sm text-primary hover:underline">
          View leads inbox →
        </Link>
      </div>
    </div>
  );
}
