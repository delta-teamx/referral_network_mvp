'use client';

import { Trophy } from 'lucide-react';

/** Admin leaderboard - coming soon. Platform-wide member rankings. */
export default function AdminLeaderboardPage() {
  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Community</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Leaderboard</h1>
      </header>
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-gray-700 bg-gray-900 p-14 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15">
          <Trophy size={30} className="text-amber-400" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Coming soon</h2>
        <p className="mx-auto max-w-sm text-sm text-gray-400">
          Platform-wide member rankings - top referrers, most deals won, most active connectors -
          will live here.
        </p>
        <span className="mt-5 inline-block rounded-full bg-amber-500/15 px-4 py-1.5 text-xs font-bold text-amber-400">
          🚀 Launching soon
        </span>
      </div>
    </div>
  );
}
