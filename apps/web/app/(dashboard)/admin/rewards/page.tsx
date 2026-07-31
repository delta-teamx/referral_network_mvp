'use client';

import { useEffect, useState } from 'react';
import { Coins, Save, Search, Scale } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Admin - Rewards & Points (Phase 2). Configure Contribution Score point
 * values and the free-plan limit, manually award/reverse a member's points,
 * and resolve disputed referrals.
 */

interface Config {
  contributionPoints: {
    referral_accepted: number;
    referral_relevant: number;
    referral_opportunity: number;
    referral_business: number;
  };
  freeEngagementLimit: number;
}

interface PickUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface DisputedReferral {
  id: string;
  clientName: string | null;
  relevanceAt: string | null;
  sender: { id: string; firstName: string; lastName: string; email: string };
  receiver: { id: string; firstName: string; lastName: string; email: string };
}

const POINT_LABELS: Record<keyof Config['contributionPoints'], string> = {
  referral_accepted: 'Referral accepted',
  referral_relevant: 'Confirmed relevant',
  referral_opportunity: 'Qualified opportunity',
  referral_business: 'Completed business',
};

export default function AdminRewardsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual adjustment.
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<PickUser[]>([]);
  const [picked, setPicked] = useState<PickUser | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustMsg, setAdjustMsg] = useState<string | null>(null);

  // Disputes.
  const [disputes, setDisputes] = useState<DisputedReferral[]>([]);

  async function load() {
    if (!accessToken) return;
    try {
      const [cfg, disp] = await Promise.all([
        api.get<Config>('/api/v1/admin/config', { accessToken }),
        api.get<DisputedReferral[]>('/api/v1/admin/referrals/disputed', { accessToken }),
      ]);
      setConfig(cfg);
      setDisputes(disp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Member search for the manual adjustment.
  useEffect(() => {
    if (!accessToken || picked) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const data = await api.get<{ users: PickUser[] }>('/api/v1/admin/users', {
          accessToken,
          query: { q: userQuery || undefined, limit: 10 },
        });
        if (!cancelled) setUserResults(data.users);
      } catch {
        if (!cancelled) setUserResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userQuery, picked, accessToken]);

  async function saveConfig() {
    if (!accessToken || !config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patch<Config>('/api/v1/admin/config', config, { accessToken });
      setConfig(updated);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function submitAdjust() {
    if (!accessToken || !picked) return;
    const points = Number(adjustPoints);
    if (!Number.isFinite(points) || points === 0 || !adjustReason.trim()) return;
    setAdjustMsg(null);
    try {
      await api.post(
        `/api/v1/admin/users/${picked.id}/points`,
        { points: Math.round(points), reason: adjustReason.trim() },
        { accessToken },
      );
      setAdjustMsg(`${points > 0 ? 'Awarded' : 'Reversed'} ${Math.abs(points)} points for ${picked.firstName}.`);
      setAdjustPoints('');
      setAdjustReason('');
      setPicked(null);
      setUserQuery('');
    } catch (err) {
      setAdjustMsg(err instanceof ApiError ? err.message : 'Adjustment failed');
    }
  }

  async function override(id: string, verdict: 'relevant' | 'opportunity' | 'not_relevant') {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/admin/referrals/${id}/override`, { verdict }, { accessToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Override failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Coins size={14} /> Rewards & points
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Contribution Score settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Tune what verified referral actions are worth, adjust a member&rsquo;s points by hand, and
          resolve disputed referrals. Changes apply to points awarded from now on.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Point values */}
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Point values</h2>
          {!config ? (
            <div className="h-40 animate-pulse rounded-xl bg-gray-800" />
          ) : (
            <div className="space-y-3">
              {(Object.keys(config.contributionPoints) as (keyof Config['contributionPoints'])[]).map(
                (key) => (
                  <label key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-300">{POINT_LABELS[key]}</span>
                    <input
                      type="number"
                      value={config.contributionPoints[key]}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          contributionPoints: {
                            ...config.contributionPoints,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                      className="w-28 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-right text-sm text-white outline-none focus:border-amber-500"
                    />
                  </label>
                ),
              )}
              <div className="my-2 border-t border-gray-800" />
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">
                  Free plan limit
                  <span className="block text-[11px] text-gray-500">intro requests / new conversations</span>
                </span>
                <input
                  type="number"
                  value={config.freeEngagementLimit}
                  onChange={(e) => setConfig({ ...config, freeEngagementLimit: Number(e.target.value) })}
                  className="w-28 rounded-lg border border-gray-700 bg-gray-950 px-3 py-1.5 text-right text-sm text-white outline-none focus:border-amber-500"
                />
              </label>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => void saveConfig()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? 'Saving…' : 'Save'}
                </button>
                {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
              </div>
            </div>
          )}
        </section>

        {/* Manual adjustment */}
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Scale size={15} className="text-amber-400" /> Adjust a member&rsquo;s points
          </h2>
          {!picked ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-950 px-3 py-2">
                <Search size={14} className="text-gray-500" />
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search a member…"
                  className="w-full bg-transparent text-sm text-gray-100 outline-none"
                />
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {userResults.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => setPicked(u)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-left hover:border-amber-500"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="block truncate text-xs text-gray-400">{u.email}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {picked.firstName} {picked.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-400">{picked.email}</p>
                </div>
                <button onClick={() => setPicked(null)} className="text-xs text-gray-400 hover:text-white">
                  Change
                </button>
              </div>
              <input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                placeholder="Points (use a negative number to reverse)"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              />
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason (required)"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              />
              <button
                onClick={() => void submitAdjust()}
                disabled={!adjustPoints || !adjustReason.trim()}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Apply adjustment
              </button>
            </div>
          )}
          {adjustMsg && <p className="mt-3 text-xs text-emerald-400">{adjustMsg}</p>}
        </section>
      </div>

      {/* Disputed referrals */}
      <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          Disputed referrals{' '}
          <span className="text-gray-500">({disputes.length})</span>
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          Referrals a recipient marked &ldquo;not relevant&rdquo;. Override if you find the referral was in
          fact valuable - the sender is then awarded.
        </p>
        {disputes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
            No disputed referrals.
          </p>
        ) : (
          <ul className="space-y-2">
            {disputes.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="text-white">
                    {d.sender.firstName} {d.sender.lastName}{' '}
                    <span className="text-gray-500">→ {d.receiver.firstName} {d.receiver.lastName}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {d.clientName ?? 'Unnamed client'}
                    {d.relevanceAt ? ` · ${new Date(d.relevanceAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void override(d.id, 'relevant')}
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Mark relevant
                  </button>
                  <button
                    onClick={() => void override(d.id, 'opportunity')}
                    className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Mark opportunity
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
