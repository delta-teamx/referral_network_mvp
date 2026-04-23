'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Briefcase, Network, Store, UserCheck, Users } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

interface Overview {
  counts: {
    users: number;
    listings: number;
    leads: number;
    referrals: number;
    groups: number;
    pendingListings: number;
  };
  tierBreakdown: Record<string, number>;
}

export default function AdminOverview() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const d = await api.get<Overview>('/api/v1/admin/overview', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const cards = [
    { key: 'users', label: 'Users', icon: Users, value: data?.counts.users ?? '—' },
    { key: 'listings', label: 'Listings', icon: Store, value: data?.counts.listings ?? '—' },
    { key: 'leads', label: 'Consumer leads', icon: Briefcase, value: data?.counts.leads ?? '—' },
    {
      key: 'referrals',
      label: 'B2B referrals',
      icon: UserCheck,
      value: data?.counts.referrals ?? '—',
    },
    { key: 'groups', label: 'Active groups', icon: Network, value: data?.counts.groups ?? '—' },
    {
      key: 'pending',
      label: 'Pending approval',
      icon: AlertTriangle,
      value: data?.counts.pendingListings ?? '—',
      highlight: true,
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Control center
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Platform overview</h1>
        <p className="mt-1 text-sm text-gray-400">
          Top-level health of the network. Drill into any section via the sidebar.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.key}
              variants={fadeInUp}
              className={`rounded-2xl border p-5 ${
                c.highlight
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
                <Icon size={14} />
                {c.label}
              </div>
              <p
                className={`text-3xl font-bold ${
                  c.highlight ? 'text-amber-400' : 'text-white'
                }`}
              >
                {c.value}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {data && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Subscription breakdown + MRR */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Subscriptions + estimated MRR
            </h2>
            <div className="space-y-2">
              {([
                { tier: 'FREE', price: 0 },
                { tier: 'PRO', price: 49 },
                { tier: 'PREMIUM', price: 149 },
              ] as const).map(({ tier, price }) => {
                const count = data.tierBreakdown[tier] ?? 0;
                const total =
                  (data.tierBreakdown.FREE ?? 0) +
                  (data.tierBreakdown.PRO ?? 0) +
                  (data.tierBreakdown.PREMIUM ?? 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const color = tier === 'FREE' ? 'bg-gray-500' : tier === 'PRO' ? 'bg-blue-500' : 'bg-amber-400';
                return (
                  <div key={tier} className="flex items-center gap-3 text-sm">
                    <span className="w-20 font-semibold text-gray-300">{tier}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-28 text-right text-xs text-gray-400">
                      {count} ({pct}%)
                  </span>
                </div>
              );
            })}
            </div>
            <div className="mt-4 rounded-xl border border-gray-800 bg-gray-800/50 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">Estimated MRR</p>
              <p className="text-2xl font-bold text-white">
                ${(
                  (data.tierBreakdown.PRO ?? 0) * 49 +
                  (data.tierBreakdown.PREMIUM ?? 0) * 149
                ).toLocaleString()}
                <span className="text-sm font-normal text-gray-400">/mo</span>
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Quick actions
            </h2>
            <div className="space-y-2">
              {[
                { href: '/admin/users', label: 'Manage users & roles', desc: 'Promote, suspend, change tiers' },
                { href: '/admin/moderation', label: 'Moderation queue', desc: `${data.counts.pendingListings} listings pending` },
                { href: '/admin/events', label: 'Create Zoom event', desc: 'Schedule a networking session' },
                { href: '/admin/listings', label: 'Browse all listings', desc: 'Feature or archive listings' },
                { href: '/admin/bookings', label: 'View all bookings', desc: 'Monitor call activity' },
                { href: '/admin/groups', label: 'Manage groups', desc: 'Archive or review groups' },
              ].map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-800/30 px-4 py-3 transition hover:border-gray-700 hover:bg-gray-800/60"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{a.label}</p>
                    <p className="text-xs text-gray-500">{a.desc}</p>
                  </div>
                  <span className="text-gray-600">&rarr;</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
