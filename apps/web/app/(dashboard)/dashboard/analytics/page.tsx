'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingUp } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

interface Analytics {
  labels: string[];
  series: {
    leads: number[];
    leadsConverted: number[];
    referrals: number[];
    referralsConverted: number[];
    reviews: number[];
  };
  ratings: {
    avg: number;
    count: number;
    distribution: { star: number; count: number }[];
  };
}

export default function AnalyticsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const a = await api.get<Analytics>('/api/v1/dashboard/analytics', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setData(a);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <UpgradeGate feature="Analytics Dashboard" requiredTier="PRO">
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Analytics</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">12-week activity</h1>
        <p className="mt-1 text-sm text-gray-500">
          Leads, referrals, reviews, and rating distribution. Driven by domain events — updates in
          near-real time.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading || !data ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard
              title="Consumer leads"
              subtitle="Total vs converted, per week"
              labels={data.labels}
              series={[
                { name: 'Received', values: data.series.leads, color: '#2563eb' },
                { name: 'Converted', values: data.series.leadsConverted, color: '#16a34a' },
              ]}
            />
            <ChartCard
              title="B2B referrals"
              subtitle="Received from peers, conversion overlay"
              labels={data.labels}
              series={[
                { name: 'Received', values: data.series.referrals, color: '#f97316' },
                {
                  name: 'Converted',
                  values: data.series.referralsConverted,
                  color: '#16a34a',
                },
              ]}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard
              title="Reviews received"
              subtitle="New reviews per week"
              labels={data.labels}
              series={[{ name: 'Reviews', values: data.series.reviews, color: '#7c3aed' }]}
            />
            <RatingCard ratings={data.ratings} />
          </div>
        </div>
      )}
    </div>
    </UpgradeGate>
  );
}

interface ChartSeries {
  name: string;
  values: number[];
  color: string;
}

function ChartCard({
  title,
  subtitle,
  labels,
  series,
}: {
  title: string;
  subtitle: string;
  labels: string[];
  series: ChartSeries[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const pad = { left: 32, right: 10, top: 10, bottom: 20 };
  const width = 520;
  const height = 200;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : innerW;

  const pathFor = (values: number[]) =>
    values
      .map((v, i) => {
        const x = pad.left + i * stepX;
        const y = pad.top + innerH - (v / max) * innerH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <p className="mb-3 text-xs text-gray-500">{subtitle}</p>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.left}
            x2={width - pad.right}
            y1={pad.top + innerH - t * innerH}
            y2={pad.top + innerH - t * innerH}
            stroke="#f3f4f6"
            strokeWidth={1}
          />
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
            {s.values.map((v, i) => {
              const x = pad.left + i * stepX;
              const y = pad.top + innerH - (v / max) * innerH;
              return <circle key={i} cx={x} cy={y} r={2.5} fill={s.color} />;
            })}
          </g>
        ))}
        {labels.map((lbl, i) => {
          if (i % 2 === 1 && i !== labels.length - 1) return null;
          const x = pad.left + i * stepX;
          return (
            <text
              key={lbl + i}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#9ca3af"
            >
              {lbl}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {series.map((s) => {
          const total = s.values.reduce((a, b) => a + b, 0);
          return (
            <span key={s.name} className="inline-flex items-center gap-1 text-gray-600">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}: <strong className="text-gray-900">{total}</strong>
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}

function RatingCard({ ratings }: { ratings: Analytics['ratings'] }) {
  const maxInDist = Math.max(1, ...ratings.distribution.map((d) => d.count));
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-1 flex items-center gap-2">
        <Star size={16} className="text-amber-400" />
        <h2 className="font-semibold text-gray-900">Review rating</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">{ratings.count} reviews in the last 12 weeks</p>

      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold text-gray-900">{ratings.avg.toFixed(1)}</span>
        <span className="text-sm text-gray-500">/ 5.0 average</span>
      </div>

      <div className="space-y-2">
        {[...ratings.distribution].reverse().map((d) => (
          <div key={d.star} className="flex items-center gap-3 text-xs">
            <span className="inline-flex w-10 items-center gap-1 text-gray-500">
              {d.star} <Star size={10} className="fill-amber-400 text-amber-400" />
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-2 bg-amber-400"
                style={{ width: `${(d.count / maxInDist) * 100}%` }}
              />
            </div>
            <span className="w-6 text-right text-gray-600">{d.count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
