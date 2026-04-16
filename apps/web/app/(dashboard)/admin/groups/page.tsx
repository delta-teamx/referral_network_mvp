'use client';

import { useEffect, useState } from 'react';
import { Archive, MapPin } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface AdminGroup {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  status: string;
  maxMembers: number;
  _count: { members: number };
}

export default function AdminGroupsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<AdminGroup[]>('/api/v1/admin/groups', {
        accessToken: accessToken ?? undefined,
      });
      setGroups(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function archive(id: string) {
    if (!accessToken) return;
    if (!window.confirm('Archive this group? Members will be notified.')) return;
    try {
      await api.post(`/api/v1/admin/groups/${id}/archive`, {}, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Archive failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Groups</p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          Networking groups{' '}
          <span className="text-sm font-normal text-gray-400">({groups.length})</span>
        </h1>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-900" />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div>
                <p className="font-semibold text-white">{g.name}</p>
                <p className="text-xs text-gray-400">
                  <MapPin size={10} className="mr-1 inline" />
                  {g.city}, {g.state} · {g._count.members}/{g.maxMembers} members
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    g.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {g.status}
                </span>
                {g.status === 'active' && (
                  <button
                    onClick={() => void archive(g.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Archive size={12} /> Archive
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
