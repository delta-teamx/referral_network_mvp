'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowUpRight, Eye, Inbox, Star, TrendingUp, UserCheck } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

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
    avgRating: number;
    avgTrustScore: number;
  };
}

export default function DashboardHomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<Metrics>('/api/v1/dashboard/metrics', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error ?? 'No metrics yet — create a listing to see your dashboard come alive.'}
        </p>
      </div>
    );
  }

  const t = metrics.totals;
  const conversionRate = t.leadsTotal > 0 ? Math.round((t.leadsConverted / t.leadsTotal) * 100) : 0;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Business dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Welcome back, {user?.firstName}</h1>
      </header>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 md:grid-cols-4"
      >
        <Metric
          icon={Eye}
          label="Listing views"
          value={t.views}
          accent="bg-primary-light text-primary"
        />
        <Metric
          icon={Inbox}
          label="New leads"
          value={t.leadsPending}
          delta={`${t.leadsTotal} total`}
          accent="bg-emerald-50 text-emerald-700"
        />
        <Metric
          icon={UserCheck}
          label="Converted"
          value={t.leadsConverted}
          delta={`${conversionRate}% rate`}
          accent="bg-amber-50 text-amber-700"
        />
        <Metric
          icon={TrendingUp}
          label="Referrals received"
          value={t.referralsReceived}
          delta={`${t.referralsConverted} converted`}
          accent="bg-rose-50 text-rose-700"
        />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.section
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your listings</h2>
            <Link
              href="/dashboard/listing"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Edit →
            </Link>
          </div>

          {metrics.listings.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <p className="mb-3 text-sm text-gray-600">
                You don&rsquo;t have a listing yet. Create one to start receiving leads.
              </p>
              <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
                Create listing
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {metrics.listings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div>
                    <Link
                      href={`/listing/${l.slug}`}
                      className="font-semibold text-gray-900 hover:text-primary"
                    >
                      {l.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {l.viewCount} views · {l.reviewCount} reviews
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {Number(l.avgRating).toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      Trust {Number(l.trustScore).toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Network health</h2>
          <div className="space-y-4">
            <Row label="Avg. rating" value={t.avgRating.toFixed(2)} icon={Star} />
            <Row
              label="Avg. trust score"
              value={`${t.avgTrustScore.toFixed(1)} / 10`}
              icon={Activity}
            />
            <Row label="Conversion rate" value={`${conversionRate}%`} icon={ArrowUpRight} />
          </div>
          <Link
            href="/dashboard/leads"
            className="mt-6 block rounded-xl bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary/90"
          >
            Open lead inbox →
          </Link>
        </motion.section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  delta,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  delta?: string;
  accent: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {delta && <p className="mt-1 text-xs text-gray-400">{delta}</p>}
    </motion.div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Star }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-2 text-gray-600">
        <Icon size={14} className="text-gray-400" />
        {label}
      </span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
