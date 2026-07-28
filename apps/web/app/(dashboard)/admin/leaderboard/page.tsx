'use client';

import { useEffect, useState } from 'react';
import { Crown, Medal, Trophy, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface LeaderboardMember {
  userId: string;
  name: string;
  businessName: string | null;
  industry: string | null;
  isFounding: boolean;
  invitesOnboarded: number;
  dealsWon: number;
  contractsSigned: number;
  referralsSent: number;
  callsHeld: number;
  points: number;
  badges: string[];
  rank: number | null;
}

interface LeaderboardData {
  members: LeaderboardMember[];
  totalMembers: number;
  participantCount: number;
}

export default function AdminLeaderboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    api
      .get<LeaderboardData>('/api/v1/referral-tracking/community', {
        accessToken: accessToken ?? undefined,
        query: showAll ? { all: 1 } : undefined,
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, showAll]);

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Community</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Leaderboard</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-400">
              {data.participantCount} of {data.totalMembers} members participating.
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-4 w-4 accent-amber-400"
          />
          Show members who haven&rsquo;t started
        </label>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3 text-center">Invites joined</th>
              <th className="px-4 py-3 text-center">Deals won</th>
              <th className="px-4 py-3 text-center">Contracts</th>
              <th className="px-4 py-3 text-center">Referrals</th>
              <th className="px-4 py-3 text-center">Calls</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : data.members.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  <Users size={20} className="mx-auto mb-2 text-gray-600" />
                  No participation yet - the board fills as members invite, book calls and close
                  deals.
                </td>
              </tr>
            ) : (
              data.members.map((m) => (
                <tr key={m.userId} className="border-t border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    {m.rank ? (
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          m.rank === 1
                            ? 'bg-amber-500/20 text-amber-300'
                            : m.rank === 2
                              ? 'bg-gray-600/40 text-gray-200'
                              : m.rank === 3
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {m.rank <= 3 ? <Medal size={13} /> : m.rank}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">not started</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium text-white">
                      {m.name}
                      {m.isFounding && <Crown size={12} className="text-amber-400" />}
                    </p>
                    <p className="text-xs text-gray-400">{m.businessName ?? m.industry ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.invitesOnboarded}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.dealsWon}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.contractsSigned}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.referralsSent}</td>
                  <td className="px-4 py-3 text-center text-gray-300">{m.callsHeld}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-300">
                    {m.points.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <Trophy size={12} className="text-amber-400" />
        Points: invite joins 50 · deal won 30 · contract signed 20 · referral sent 10 · call held 5.
        Invites only count after the invitee completes onboarding.
      </p>
    </div>
  );
}
