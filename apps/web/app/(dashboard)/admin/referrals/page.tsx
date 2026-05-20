'use client';

import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface OnboardingMember {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  signedUpAt: string;
  currentMonth: number;
  countsByMonth: Record<number, number>;
  totalAssigned: number;
}

const TARGET = 10;
const MONTHS = [1, 2, 3];

export default function AdminReferralsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<OnboardingMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<OnboardingMember[]>('/api/v1/ai/admin/onboarding-members', {
        accessToken: accessToken ?? undefined,
      });
      setRows(data);
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

  async function assign(userId: string, month: number) {
    if (!accessToken) return;
    const key = `${userId}-${month}`;
    setBusyKey(key);
    setToast(null);
    try {
      const result = await api.post<{ assigned: number; totalActiveForMonth: number }>(
        `/api/v1/ai/admin/members/${userId}/onboarding-referrals`,
        { month },
        { accessToken: accessToken ?? undefined },
      );
      setToast(
        `Assigned ${result.assigned} referrals (month ${month} now at ${result.totalActiveForMonth}/${TARGET}).`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Assign failed');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding referrals</h1>
          <p className="text-sm text-gray-600">
            Members in their first {MONTHS.length} months. Each should have {TARGET} curated referrals per
            month — top up any gaps below.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {toast && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Loading members…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-12 text-center text-gray-500">
          No members currently in their first 3 months.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Now in</th>
                {MONTHS.map((m) => (
                  <th key={m} className="px-4 py-3 text-center">
                    Month {m}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{row.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(row.signedUpAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      Month {row.currentMonth}
                    </span>
                  </td>
                  {MONTHS.map((m) => {
                    const count = row.countsByMonth[m] ?? 0;
                    const pct = Math.min(100, Math.round((count / TARGET) * 100));
                    const isComplete = count >= TARGET;
                    return (
                      <td key={m} className="px-4 py-3 text-center">
                        <div className="mx-auto w-16">
                          <p className={`text-xs font-semibold ${isComplete ? 'text-green-700' : 'text-gray-700'}`}>
                            {count}/{TARGET}
                          </p>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {MONTHS.map((m) => {
                        const count = row.countsByMonth[m] ?? 0;
                        const isComplete = count >= TARGET;
                        const key = `${row.userId}-${m}`;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => void assign(row.userId, m)}
                            disabled={isComplete || busyKey === key}
                            title={isComplete ? `Month ${m} is full` : `Top up month ${m}`}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3 w-3" />M{m}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
