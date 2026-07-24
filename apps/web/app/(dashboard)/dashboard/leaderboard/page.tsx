'use client';

import { Trophy } from 'lucide-react';

/** Leaderboard — coming soon. Will rank members by referrals given, deals
 *  won and network activity. */
export default function LeaderboardPage() {
  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Community</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Leaderboard</h1>
      </header>
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-gray-200 bg-white p-14 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
          <Trophy size={30} className="text-amber-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Coming soon</h2>
        <p className="mx-auto max-w-sm text-sm text-gray-600">
          The community leaderboard is on its way — top referrers, most deals won, and the most
          active connectors, celebrated every month.
        </p>
        <span className="mt-5 inline-block rounded-full bg-primary-light px-4 py-1.5 text-xs font-bold text-primary">
          🚀 Launching soon
        </span>
      </div>
    </div>
  );
}
