'use client';

import { useEffect, useMemo, useState } from 'react';
import { Database, Search } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface MemberCrmRow {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subscriptionTier: string;
  signedUpAt: string;
  lastLoginAt: string | null;
  paymentStatus: 'active' | 'past_due' | 'canceled' | 'none';
  renewsAt: string | null;
  engagementScore: number;
  introsRequested: number;
  introsAccepted: number;
  meetingsAttended: number;
  totalConnections: number;
}

const PAYMENT_STYLES: Record<MemberCrmRow['paymentStatus'], string> = {
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-700',
  none: 'bg-gray-100 text-gray-500',
};

export default function AdminCrmPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<MemberCrmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<MemberCrmRow[]>('/api/v1/ai/admin/crm', {
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tierFilter && r.subscriptionTier !== tierFilter) return false;
      if (!q) return true;
      return (
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    });
  }, [rows, query, tierFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Member CRM</h1>
          <p className="text-sm text-gray-600">
            One row per member: signup, payment, renewal, engagement, intros, meetings, connections.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <section className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All tiers</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="PREMIUM">Premium</option>
        </select>
        <span className="ml-2 text-xs text-gray-500">{filtered.length} of {rows.length} members</span>
      </section>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
          No members matched.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Signed up</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2">Renews</th>
                <th className="px-4 py-2 text-center">Score</th>
                <th className="px-4 py-2 text-center">Intros R / A</th>
                <th className="px-4 py-2 text-center">Mtgs</th>
                <th className="px-4 py-2 text-center">Conns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr key={row.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-900">{row.firstName} {row.lastName}</p>
                    <p className="text-xs text-gray-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      {row.subscriptionTier}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STYLES[row.paymentStatus]}`}
                    >
                      {row.paymentStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(row.signedUpAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {row.renewsAt ? new Date(row.renewsAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.engagementScore >= 60
                          ? 'bg-green-100 text-green-800'
                          : row.engagementScore >= 20
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {row.engagementScore}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-xs text-gray-700">
                    {row.introsRequested} / {row.introsAccepted}
                  </td>
                  <td className="px-4 py-2 text-center text-xs text-gray-700">{row.meetingsAttended}</td>
                  <td className="px-4 py-2 text-center text-xs text-gray-700">{row.totalConnections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
