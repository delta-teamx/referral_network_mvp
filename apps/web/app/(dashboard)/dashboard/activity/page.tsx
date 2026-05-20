'use client';

import { useEffect, useState } from 'react';
import { Activity, Calendar, DollarSign, Flame, Handshake, Sparkles, TrendingUp, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface MemberRoi {
  introsReceived: number;
  meetingsBooked: number;
  dealsClosed: number;
  estimatedValue: number;
}

interface Engagement {
  userId: string;
  score: number;
  signals: {
    recentLogin: boolean;
    introsRequested: number;
    introsAccepted: number;
    meetingsAttended: number;
  };
}

interface MonthBucket {
  monthStart: string;
  label: string;
  introsRequested: number;
  introsAccepted: number;
  meetingsBooked: number;
  connectionsMade: number;
}

interface MemberAnalytics {
  months: MonthBucket[];
  totals: {
    introsRequested: number;
    introsAccepted: number;
    meetingsBooked: number;
    connectionsMade: number;
  };
}

type SeriesKey = 'introsRequested' | 'introsAccepted' | 'meetingsBooked' | 'connectionsMade';

const SERIES: { key: SeriesKey; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'introsRequested', label: 'Intros requested', color: 'bg-blue-500', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'introsAccepted', label: 'Intros accepted', color: 'bg-green-500', icon: <UserPlus className="h-4 w-4" /> },
  { key: 'meetingsBooked', label: 'Meetings booked', color: 'bg-purple-500', icon: <Calendar className="h-4 w-4" /> },
  { key: 'connectionsMade', label: 'Connections made', color: 'bg-amber-500', icon: <Users className="h-4 w-4" /> },
];

export default function ActivityPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<MemberAnalytics | null>(null);
  const [roi, setRoi] = useState<MemberRoi | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const [analyticsRes, roiRes, engagementRes] = await Promise.all([
          api.get<MemberAnalytics>('/api/v1/ai/analytics/me?months=6', {
            accessToken: accessToken ?? undefined,
          }),
          api.get<MemberRoi>('/api/v1/ai/roi/me', {
            accessToken: accessToken ?? undefined,
          }),
          api.get<Engagement>('/api/v1/ai/engagement/me', {
            accessToken: accessToken ?? undefined,
          }),
        ]);
        if (cancelled) return;
        setData(analyticsRes);
        setRoi(roiRes);
        setEngagement(engagementRes);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
        Loading activity…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? 'No activity data.'}
      </div>
    );
  }

  const currentMonth = data.months[data.months.length - 1];
  const previousMonth = data.months[data.months.length - 2];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your activity</h1>
          <p className="text-sm text-gray-600">Intros, meetings, and connections — last 6 months.</p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERIES.map((s) => {
          const current = currentMonth?.[s.key] ?? 0;
          const previous = previousMonth?.[s.key] ?? 0;
          const delta = current - previous;
          return (
            <div key={s.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                {s.icon}
                {s.label}
              </div>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{current}</p>
              <p className="mt-1 text-xs text-gray-500">
                {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${delta}`} vs last month
              </p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-600">
          6-month history
        </h2>
        <BarHistogram months={data.months} />
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-sm ${s.color}`} />
              {s.label}
            </span>
          ))}
        </div>
      </section>

      {roi && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            <TrendingUp className="h-4 w-4" />
            ROI (lifetime)
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <RoiStat label="Intros received" value={roi.introsReceived} icon={<UserPlus className="h-4 w-4" />} />
            <RoiStat label="Meetings booked" value={roi.meetingsBooked} icon={<Calendar className="h-4 w-4" />} />
            <RoiStat label="Deals closed" value={roi.dealsClosed} icon={<Handshake className="h-4 w-4" />} />
            <RoiStat
              label="Estimated value"
              value={`$${roi.estimatedValue.toLocaleString()}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
          </div>
        </section>
      )}

      {engagement && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
            <Flame className="h-4 w-4" />
            Engagement score
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-gray-900">{engagement.score}</div>
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full ${engagement.score >= 60 ? 'bg-green-500' : engagement.score >= 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${engagement.score}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-600">
                Based on the last 30 days: {engagement.signals.introsRequested} intros sent ·{' '}
                {engagement.signals.introsAccepted} accepted · {engagement.signals.meetingsAttended} meetings
                {engagement.signals.recentLogin ? ' · recent login ✓' : ''}.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Cumulative (last 6 months)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SERIES.map((s) => (
            <div key={s.key} className="rounded-md bg-gray-50 p-3">
              <p className="text-2xl font-semibold text-gray-900">{data.totals[s.key]}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RoiStat({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md bg-gray-50 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function BarHistogram({ months }: { months: MonthBucket[] }) {
  const max = Math.max(
    1,
    ...months.flatMap((m) =>
      SERIES.map((s) => m[s.key]),
    ),
  );

  return (
    <div className="space-y-3">
      {months.map((m) => (
        <div key={m.monthStart} className="flex items-end gap-2">
          <div className="w-20 shrink-0 text-xs text-gray-500">{m.label}</div>
          <div className="flex flex-1 items-end gap-1.5">
            {SERIES.map((s) => {
              const value = m[s.key];
              const height = Math.max(2, Math.round((value / max) * 64));
              return (
                <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm ${s.color}`}
                    style={{ height: `${height}px`, opacity: value === 0 ? 0.25 : 1 }}
                    title={`${s.label}: ${value}`}
                  />
                  <span className="text-[10px] text-gray-500">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
