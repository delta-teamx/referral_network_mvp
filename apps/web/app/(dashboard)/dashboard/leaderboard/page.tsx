'use client';

import { useEffect, useState } from 'react';
import { Crown, Sparkles, Trophy } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  businessName: string | null;
  score: number;
  intros: number;
  meetings: number;
}

const PODIUM_COLORS = ['bg-amber-100 text-amber-700', 'bg-gray-200 text-gray-700', 'bg-orange-100 text-orange-700'];

export default function LeaderboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<LeaderboardEntry[]>('/api/v1/ai/leaderboard?limit=20', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setRows(data);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top networkers</h1>
          <p className="text-sm text-gray-600">
            Members ranked by engagement score over the last 30 days — intros sent, intros accepted, and
            meetings attended all count.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
          No leaderboard data yet — be the first.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const rank = idx + 1;
              const isMe = row.userId === userId;
              return (
                <li
                  key={row.userId}
                  className={`flex items-center gap-4 px-5 py-3 ${isMe ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      idx < 3 ? PODIUM_COLORS[idx] : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx === 0 ? <Crown className="h-4 w-4" /> : rank}
                  </span>
                  {row.avatarUrl ? (
                    <img src={row.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {row.firstName.charAt(0)}
                      {row.lastName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {row.firstName} {row.lastName}
                      {isMe && <span className="ml-2 text-xs font-medium text-primary">(you)</span>}
                    </p>
                    {row.businessName && <p className="truncate text-xs text-gray-500">{row.businessName}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>
                      <strong className="text-gray-900">{row.intros}</strong> intros
                    </span>
                    <span>
                      <strong className="text-gray-900">{row.meetings}</strong> meetings
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
                      <Sparkles className="h-3 w-3" />
                      {row.score}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
