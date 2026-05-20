'use client';

import { useEffect, useState } from 'react';
import { Linkedin, Sparkles, TrendingUp } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

const STATUSES = [
  'identified',
  'connection_sent',
  'connected',
  'invited',
  'attended',
  'converted',
  'declined',
] as const;
type Status = (typeof STATUSES)[number];

interface PipelineSnapshot {
  byStatus: Record<Status, number>;
  total: number;
  topByFit: Array<{ id: string; fullName: string; fitScore: number; status: Status }>;
  topLeaderCandidates: Array<{ id: string; fullName: string; leaderScore: number; status: Status }>;
}

interface Prospect {
  id: string;
  fullName: string;
  headline: string | null;
  linkedInUrl: string;
  industry: string | null;
  jobRole: string | null;
  location: string | null;
  fitScore: number;
  leaderScore: number;
  status: Status;
  assignedGroup: { id: string; name: string; city: string; state: string } | null;
}

export default function AdminProspectsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [mode, setMode] = useState<'fit' | 'leader'>('fit');
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [snap, list] = await Promise.all([
        api.get<PipelineSnapshot>('/api/v1/linkedin-prospects/pipeline', {
          accessToken: accessToken ?? undefined,
        }),
        api.get<Prospect[]>(
          `/api/v1/linkedin-prospects?mode=${mode}${statusFilter ? `&status=${statusFilter}` : ''}`,
          { accessToken: accessToken ?? undefined },
        ),
      ]);
      setSnapshot(snap);
      setProspects(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode, statusFilter]);

  async function advance(id: string, newStatus: Status) {
    if (!accessToken) return;
    setBusy(id);
    try {
      await api.post(
        `/api/v1/linkedin-prospects/${id}/advance`,
        { status: newStatus },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Advance failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
          <Linkedin className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn pipeline</h1>
          <p className="text-sm text-gray-600">
            Prospects mined from LinkedIn, scored for NRG fit, and routed to a regional group. Walk them
            through the outreach flow below.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {snapshot && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`rounded-md border p-3 text-left transition ${
                statusFilter === s ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="text-2xl font-bold text-gray-900">{snapshot.byStatus[s] ?? 0}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{s.replace('_', ' ')}</p>
            </button>
          ))}
        </section>
      )}

      <section className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Rank by:</span>
        <button
          type="button"
          onClick={() => setMode('fit')}
          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            mode === 'fit' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          NRG fit
        </button>
        <button
          type="button"
          onClick={() => setMode('leader')}
          className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            mode === 'leader' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          Group leader
        </button>
        {statusFilter && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            Filter: {statusFilter.replace('_', ' ')}
            <button onClick={() => setStatusFilter('')} className="text-gray-400 hover:text-gray-700">
              ×
            </button>
          </span>
        )}
      </section>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">Loading…</div>
      ) : prospects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
          No prospects yet. Ingest via POST /api/v1/linkedin-prospects or /bulk.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2">Prospect</th>
                <th className="px-4 py-2">Industry · Role</th>
                <th className="px-4 py-2">Assigned group</th>
                <th className="px-4 py-2 text-center">{mode === 'leader' ? 'Leader' : 'Fit'} score</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Advance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prospects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <a href={p.linkedInUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                      {p.fullName}
                    </a>
                    {p.headline && <p className="text-xs text-gray-500">{p.headline}</p>}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {p.industry ?? '—'} · {p.jobRole ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {p.assignedGroup
                      ? `${p.assignedGroup.name} (${p.assignedGroup.city}, ${p.assignedGroup.state})`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {mode === 'leader' ? p.leaderScore : p.fitScore}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <select
                      value={p.status}
                      disabled={busy === p.id}
                      onChange={(e) => void advance(p.id, e.target.value as Status)}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
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
