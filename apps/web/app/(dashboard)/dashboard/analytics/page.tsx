'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { KanbanSquare, Star, TrendingUp, Trophy } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

interface PipelineStats {
  stages: { stage: string; count: number }[];
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number;
}

interface Analytics {
  labels: string[];
  series: {
    leads: number[];
    leadsConverted: number[];
    referrals: number[];
    referralsConverted: number[];
    reviews: number[];
    messages?: number[];
    bookings?: number[];
    intros?: number[];
    won?: number[];
  };
  pipeline?: PipelineStats | null;
  ratings: {
    avg: number;
    count: number;
    distribution: { star: number; count: number }[];
  };
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  new: { label: 'New lead', color: '#0ea5e9' },
  in_process: { label: 'In process', color: '#3b82f6' },
  zoom_booked: { label: 'Zoom booked', color: '#8b5cf6' },
  follow_up: { label: 'Follow-up', color: '#f59e0b' },
  signing_contract: { label: 'Signing contract', color: '#f97316' },
  contract_signed: { label: 'Contract signed', color: '#14b8a6' },
  won: { label: 'Won', color: '#10b981' },
  lost: { label: 'Lost', color: '#f43f5e' },
  dead: { label: 'Dead lead', color: '#9ca3af' },
};

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
    // Refresh whenever the tab regains focus, so pipeline moves show up.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [accessToken]);

  const p = data?.pipeline ?? null;

  return (
    <UpgradeGate feature="Analytics Dashboard" requiredTier="PRO">
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Analytics</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Your growth report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live from your activity: pipeline stages, intros, messages, calls, referrals and wins.
          Move a card on the{' '}
          <Link href="/dashboard/leads" className="font-semibold text-primary hover:underline">
            Pipeline
          </Link>{' '}
          and this report updates.
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
          {/* ── Pipeline snapshot ─────────────────────────────────── */}
          {p && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatTile label="Leads in pipeline" value={p.total} />
              <StatTile label="Open deals" value={p.open} />
              <StatTile label="Won" value={p.won} tone="text-emerald-600" />
              <StatTile label="Lost / dead" value={p.lost} tone="text-rose-500" />
              <StatTile label="Win rate" value={`${p.winRate}%`} tone="text-primary" />
            </div>
          )}

          {p && (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <KanbanSquare size={16} className="text-primary" />
                <h2 className="font-semibold text-gray-900">Pipeline funnel</h2>
              </div>
              <p className="mb-4 text-xs text-gray-500">
                Where your {p.total} leads sit right now, stage by stage.
              </p>
              <div className="space-y-2.5">
                {p.stages.map((s) => {
                  const meta = STAGE_META[s.stage] ?? { label: s.stage, color: '#9ca3af' };
                  const maxCount = Math.max(1, ...p.stages.map((x) => x.count));
                  return (
                    <div key={s.stage} className="flex items-center gap-3 text-xs">
                      <span className="w-32 shrink-0 text-gray-600">{meta.label}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="flex h-5 items-center rounded-full pl-2 text-[10px] font-bold text-white transition-all duration-500"
                          style={{
                            width: `${Math.max(s.count === 0 ? 0 : 8, (s.count / maxCount) * 100)}%`,
                            backgroundColor: meta.color,
                          }}
                        >
                          {s.count > 0 ? s.count : ''}
                        </div>
                      </div>
                      <span className="w-6 text-right font-semibold text-gray-700">{s.count}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Weekly trends ─────────────────────────────────────── */}
          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard
              title="Networking activity"
              subtitle="Messages, calls and intro requests per week"
              labels={data.labels}
              series={[
                { name: 'Messages', values: data.series.messages ?? [], color: '#0891b2' },
                { name: 'Calls booked', values: data.series.bookings ?? [], color: '#db2777' },
                { name: 'Intros', values: data.series.intros ?? [], color: '#8b5cf6' },
              ]}
            />
            <ChartCard
              title="Deals won"
              subtitle="Pipeline cards moved to Won, per week"
              labels={data.labels}
              series={[{ name: 'Won', values: data.series.won ?? [], color: '#10b981' }]}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ChartCard
              title="Client referrals"
              subtitle="Received from partners, with conversions"
              labels={data.labels}
              series={[
                { name: 'Received', values: data.series.referrals, color: '#f97316' },
                { name: 'Converted', values: data.series.referralsConverted, color: '#16a34a' },
              ]}
            />
            <ChartCard
              title="Consumer leads"
              subtitle="From the public directory, with conversions"
              labels={data.labels}
              series={[
                { name: 'Received', values: data.series.leads, color: '#2563eb' },
                { name: 'Converted', values: data.series.leadsConverted, color: '#16a34a' },
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

function StatTile({
  label,
  value,
  tone = 'text-gray-900',
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

interface ChartSeries {
  name: string;
  values: number[];
  color: string;
}

/**
 * Line chart with a proper hover cursor: moving the mouse shows a vertical
 * guide plus the exact values for that week in a floating tooltip.
 */
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
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round((x - pad.left) / stepX);
    setHover(idx >= 0 && idx < labels.length ? idx : null);
  }

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

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
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
          {hover !== null && (
            <line
              x1={pad.left + hover * stepX}
              x2={pad.left + hover * stepX}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {series.map((s) => (
            <g key={s.name}>
              <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
              {s.values.map((v, i) => {
                const x = pad.left + i * stepX;
                const y = pad.top + innerH - (v / max) * innerH;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={hover === i ? 4 : 2.5}
                    fill={s.color}
                  />
                );
              })}
            </g>
          ))}
          {labels.map((lbl, i) => {
            if (i % 2 === 1 && i !== labels.length - 1) return null;
            const x = pad.left + i * stepX;
            return (
              <text key={lbl + i} x={x} y={height - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {lbl}
              </text>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] shadow-lg"
            style={{
              left: `${Math.min(78, ((pad.left + hover * stepX) / width) * 100)}%`,
            }}
          >
            <p className="mb-1 font-semibold text-gray-900">Week of {labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 text-gray-600">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}: <strong className="text-gray-900">{s.values[hover] ?? 0}</strong>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {series.map((s) => {
          const total = s.values.reduce((a, b) => a + b, 0);
          return (
            <span key={s.name} className="inline-flex items-center gap-1 text-gray-600">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
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
              <div className="h-2 bg-amber-400" style={{ width: `${(d.count / maxInDist) * 100}%` }} />
            </div>
            <span className="w-6 text-right text-gray-600">{d.count}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-primary-light/40 px-4 py-3 text-xs text-gray-600">
        <Trophy size={12} className="mr-1 inline text-primary" />
        Wins on your <Link href="/dashboard/leads" className="font-semibold text-primary hover:underline">Pipeline</Link>{' '}
        and signed contracts also feed this report automatically.
      </div>
    </motion.div>
  );
}
