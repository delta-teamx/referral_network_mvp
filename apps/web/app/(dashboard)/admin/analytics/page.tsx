'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Gift, Trophy, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface Analytics {
  members: { total: number; free: number; pro: number; premium: number };
  invites: { sent: number; signedUp: number; onboarded: number };
  referrals: {
    total: number;
    accepted: number;
    relevant: number;
    opportunity: number;
    business: number;
    declined: number;
    unverified: number;
    acceptedPct: number;
    relevantPct: number;
  };
  rewards: { total: number; byType: Record<string, number> };
  contribution: { pointsAwarded: number };
  topContributors: { userId: string; name: string; points: number }[];
  watchlist: { userId: string; name: string; referrals30d: number }[];
}

interface SpamSuspect {
  userId: string;
  name: string;
  email: string;
  score: number;
  reasons: string[];
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<Analytics | null>(null);
  const [suspects, setSuspects] = useState<SpamSuspect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actioned, setActioned] = useState<Set<string>>(new Set());

  async function loadSuspects() {
    if (!accessToken) return;
    try {
      const s = await api.get<SpamSuspect[]>('/api/v1/admin/spam-suspects', { accessToken });
      setSuspects(s);
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const d = await api.get<Analytics>('/api/v1/admin/analytics', { accessToken });
        setData(d);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Load failed');
      }
    })();
    void loadSuspects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function suspend(s: SpamSuspect) {
    if (!accessToken) return;
    const reason = window.prompt(`Suspend ${s.name}? Reason:`, `Spam: ${s.reasons[0] ?? 'flagged'}`);
    if (!reason || reason.length < 3) return;
    try {
      await api.post(`/api/v1/admin/users/${s.userId}/suspend`, { reason }, { accessToken });
      setActioned((prev) => new Set(prev).add(s.userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suspend failed');
    }
  }

  async function remove(s: SpamSuspect) {
    if (!accessToken) return;
    if (!window.confirm(`PERMANENTLY delete ${s.name} (${s.email}) and all their data? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/admin/users/${s.userId}`, { accessToken });
      setActioned((prev) => new Set(prev).add(s.userId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <BarChart3 size={14} /> Analytics
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Referral & rewards funnel</h1>
        <p className="mt-1 text-sm text-gray-400">
          How invites, verified referrals and rewards are converting across the network.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {!data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-gray-900" />
      ) : (
        <div className="space-y-8">
          {/* Membership */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Users size={15} /> Membership
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total members" value={data.members.total.toLocaleString()} />
              <Stat label="Free" value={data.members.free.toLocaleString()} sub={`${Math.round((data.members.free / (data.members.total || 1)) * 100)}%`} />
              <Stat label="Pro" value={data.members.pro.toLocaleString()} />
              <Stat label="Premium" value={data.members.premium.toLocaleString()} />
            </div>
          </section>

          {/* Invite funnel */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
              <UserPlus size={15} /> Invite funnel
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Invites sent" value={data.invites.sent.toLocaleString()} />
              <Stat label="Signed up" value={data.invites.signedUp.toLocaleString()} />
              <Stat label="Completed profile" value={data.invites.onboarded.toLocaleString()} />
            </div>
          </section>

          {/* Referral funnel */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Trophy size={15} /> Referral quality funnel
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Referrals made" value={data.referrals.total.toLocaleString()} />
              <Stat label="Accepted" value={data.referrals.accepted.toLocaleString()} sub={`${data.referrals.acceptedPct}%`} />
              <Stat label="Confirmed relevant" value={data.referrals.relevant.toLocaleString()} sub={`${data.referrals.relevantPct}%`} />
              <Stat label="Opportunities" value={data.referrals.opportunity.toLocaleString()} />
              <Stat label="Completed business" value={data.referrals.business.toLocaleString()} />
              <Stat label="Declined" value={data.referrals.declined.toLocaleString()} />
              <Stat label="Awaiting verification" value={data.referrals.unverified.toLocaleString()} />
              <Stat label="Points awarded" value={data.contribution.pointsAwarded.toLocaleString()} />
            </div>
          </section>

          {/* Rewards */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Gift size={15} /> Rewards redeemed
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total redemptions" value={data.rewards.total.toLocaleString()} />
              <Stat label="Premium trials" value={data.rewards.byType.premium ?? 0} />
              <Stat label="Ranking boosts" value={data.rewards.byType.boost ?? 0} />
              <Stat label="Featured" value={data.rewards.byType.featured ?? 0} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top contributors */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy size={15} className="text-amber-400" /> Top contributors
              </h2>
              {data.topContributors.length === 0 ? (
                <p className="text-sm text-gray-500">No contribution points yet.</p>
              ) : (
                <ol className="space-y-2">
                  {data.topContributors.map((c, i) => (
                    <li key={c.userId} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200">
                        <span className="mr-2 text-gray-500">#{i + 1}</span>
                        {c.name}
                      </span>
                      <span className="font-semibold text-amber-300">{c.points.toLocaleString()} pts</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Watchlist */}
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <AlertTriangle size={15} className="text-rose-400" /> High-activity watchlist
              </h2>
              <p className="mb-3 text-xs text-gray-400">
                Members who sent 25+ referrals in the last 30 days - worth a spot check for abuse.
              </p>
              {data.watchlist.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing unusual right now.</p>
              ) : (
                <ul className="space-y-2">
                  {data.watchlist.map((w) => (
                    <li key={w.userId} className="flex items-center justify-between text-sm">
                      <span className="text-gray-200">{w.name}</span>
                      <span className="font-semibold text-rose-300">{w.referrals30d} in 30d</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Spam suspects */}
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle size={15} className="text-rose-400" /> Spam suspects
              <span className="text-gray-500">({suspects.length})</span>
            </h2>
            <p className="mb-3 text-xs text-gray-400">
              Flagged by automated rules (burst messaging, mass referrals, duplicate messages, empty
              profiles, disposable emails). Review before acting - these are flags, not proof.
            </p>
            {suspects.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
                No spam suspects right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {suspects.map((s) => {
                  const done = actioned.has(s.userId);
                  return (
                    <li
                      key={s.userId}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3 ${done ? 'opacity-50' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm text-white">
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            score {s.score}
                          </span>
                          {s.name}
                          <span className="text-gray-500">· {s.email}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">{s.reasons.join(' · ')}</p>
                      </div>
                      {done ? (
                        <span className="text-xs font-semibold text-emerald-400">Actioned</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => void suspend(s)}
                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => void remove(s)}
                            className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
