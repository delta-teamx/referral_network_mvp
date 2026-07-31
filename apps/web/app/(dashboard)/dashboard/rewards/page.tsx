'use client';

import { useEffect, useState } from 'react';
import { Crown, Gift, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface RewardDef {
  key: string;
  label: string;
  description: string;
  type: 'premium' | 'boost' | 'featured';
  cost: number;
  durationDays: number;
  enabled: boolean;
}
interface ActiveReward {
  id: string;
  rewardKey: string;
  type: string;
  expiresAt: string;
}
interface RewardsData {
  balance: number;
  catalog: RewardDef[];
  active: ActiveReward[];
}

const TYPE_ICON: Record<string, typeof Zap> = {
  premium: Crown,
  boost: TrendingUp,
  featured: Star,
};

export default function RewardsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<RewardsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    try {
      const d = await api.get<RewardsData>('/api/v1/rewards', { accessToken });
      setData(d);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load rewards');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function redeem(reward: RewardDef) {
    if (!accessToken) return;
    setBusyKey(reward.key);
    setError(null);
    setFlash(null);
    try {
      await api.post('/api/v1/rewards/redeem', { rewardKey: reward.key }, { accessToken });
      setFlash(`${reward.label} unlocked. Enjoy it while it lasts!`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not redeem this reward');
    } finally {
      setBusyKey(null);
    }
  }

  const activeByKey = new Set((data?.active ?? []).map((a) => a.rewardKey));

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rewards</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Gift size={22} /> Rewards store
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Spend the points you earn from verified referrals and invites on temporary perks. Rewards
          last for a set time, then expire.
        </p>
      </header>

      {/* Balance */}
      <div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-blue-600 px-6 py-5 text-white shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/80">Your points balance</p>
          <p className="text-3xl font-bold">{data ? data.balance.toLocaleString() : '—'}</p>
        </div>
        <Sparkles size={32} className="text-white/70" />
      </div>

      {flash && (
        <p className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {flash}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Active rewards */}
      {data && data.active.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Active now</h2>
          <ul className="flex flex-wrap gap-2">
            {data.active.map((a) => (
              <li
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                <Zap size={12} /> {a.rewardKey.replace(/_/g, ' ')} · until{' '}
                {new Date(a.expiresAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Catalog */}
      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : data.catalog.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-600">
          No rewards are available right now. Check back soon.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.catalog.map((r) => {
            const Icon = TYPE_ICON[r.type] ?? Gift;
            const active = activeByKey.has(r.key);
            const affordable = data.balance >= r.cost;
            return (
              <li
                key={r.key}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary">
                    <Icon size={16} />
                  </span>
                  <p className="font-semibold text-gray-900">{r.label}</p>
                </div>
                <p className="flex-1 text-sm text-gray-600">{r.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{r.cost.toLocaleString()} pts</span>
                  <button
                    onClick={() => void redeem(r)}
                    disabled={busyKey === r.key || active || !affordable}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {active
                      ? 'Active'
                      : busyKey === r.key
                        ? 'Redeeming…'
                        : affordable
                          ? 'Redeem'
                          : 'Not enough'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
