'use client';

import { useEffect, useState } from 'react';
import { Ban, Search } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  subscriptionTier: string;
  emailVerified: boolean;
  createdAt: string;
  _count: { listings: number; referralsSent: number };
}

export default function AdminUsersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<{ users: AdminUser[]; total: number }>('/api/v1/admin/users', {
        query: { q: q || undefined, limit: 50 },
        accessToken: accessToken ?? undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, q]);

  async function setRole(id: string, role: string) {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/admin/users/${id}/role`, { role }, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  async function suspend(id: string) {
    if (!accessToken) return;
    const reason = window.prompt('Suspension reason? (required)');
    if (!reason || reason.length < 3) return;
    try {
      await api.post(
        `/api/v1/admin/users/${id}/suspend`,
        { reason },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suspend failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Users</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            All accounts{' '}
            <span className="text-sm font-normal text-gray-400">({total.toLocaleString()})</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
          <Search size={14} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name…"
            className="w-64 bg-transparent text-sm text-gray-100 outline-none"
          />
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No users match.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => void setRole(u.id, e.target.value)}
                      className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100"
                    >
                      {['CONSUMER', 'BUSINESS_OWNER', 'GROUP_LEADER', 'CITY_CAPTAIN', 'ADMIN'].map(
                        (r) => (
                          <option key={r}>{r}</option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.subscriptionTier === 'PREMIUM'
                          ? 'bg-amber-500/20 text-amber-300'
                          : u.subscriptionTier === 'PRO'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {u.subscriptionTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u._count.listings}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void suspend(u.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Ban size={12} /> Suspend
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
