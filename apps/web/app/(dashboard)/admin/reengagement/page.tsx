'use client';

import { useEffect, useState } from 'react';
import { Mail, RefreshCw, Send } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface EngagementRow {
  userId: string;
  score: number;
  signals: {
    recentLogin: boolean;
    introsRequested: number;
    introsAccepted: number;
    meetingsAttended: number;
  };
}

interface CampaignResult {
  scanned: number;
  dormant: number;
  emailsSent: number;
  skippedEmpty: number;
  errors: number;
  dryRunRecipients?: Array<{ userId: string; email: string; score: number; newMatches: number }>;
}

const DORMANT_THRESHOLD = 20;

export default function AdminReengagementPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CampaignResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<EngagementRow[]>('/api/v1/ai/admin/engagement', {
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

  async function runPreview() {
    if (!accessToken) return;
    setBusy(true);
    setToast(null);
    try {
      const result = await api.post<CampaignResult>(
        '/api/v1/ai/admin/reengagement?dryRun=1',
        {},
        { accessToken: accessToken ?? undefined },
      );
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendCampaign() {
    if (!accessToken) return;
    if (!confirm(`Send re-engagement emails to ${preview?.dryRunRecipients?.length ?? '?'} dormant members?`)) {
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const result = await api.post<CampaignResult>(
        '/api/v1/ai/admin/reengagement',
        {},
        { accessToken: accessToken ?? undefined },
      );
      setToast(
        `Sent ${result.emailsSent} emails (${result.skippedEmpty} skipped, ${result.errors} errors).`,
      );
      setPreview(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  const dormant = rows.filter((r) => r.score < DORMANT_THRESHOLD).sort((a, b) => a.score - b.score);
  const healthy = rows.length - dormant.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Re-engagement</h1>
          <p className="text-sm text-gray-600">
            Bulk outreach to dormant members. Score is computed from logins, intros, and meetings over the last
            30 days; below {DORMANT_THRESHOLD} counts as dormant.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {toast && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{toast}</div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total members" value={rows.length} />
        <Stat label="Dormant" value={dormant.length} highlight />
        <Stat label="Engaged" value={healthy} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Campaign</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => void sendCampaign()}
              disabled={busy || !preview || (preview.dryRunRecipients?.length ?? 0) === 0}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Send to {preview?.dryRunRecipients?.length ?? 0}
            </button>
          </div>
        </div>

        {preview ? (
          <div>
            <p className="text-xs text-gray-600">
              Scanned {preview.scanned}, dormant {preview.dormant}, recipients{' '}
              {preview.dryRunRecipients?.length ?? 0}, skipped (no new matches) {preview.skippedEmpty}.
            </p>
            {preview.dryRunRecipients && preview.dryRunRecipients.length > 0 && (
              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs text-gray-700">
                {preview.dryRunRecipients.map((r) => (
                  <li key={r.userId} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1">
                    <span className="truncate">{r.email}</span>
                    <span className="shrink-0 text-gray-500">
                      score {r.score} · {r.newMatches} new
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Click Preview to see who would receive a re-engagement email.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Dormant members ({dormant.length})
        </h2>
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading…</div>
        ) : dormant.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">Everyone is engaged. Nice work.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2">User</th>
                <th className="px-5 py-2 text-center">Score</th>
                <th className="px-5 py-2 text-center">Recent login</th>
                <th className="px-5 py-2 text-center">Intros sent</th>
                <th className="px-5 py-2 text-center">Intros accepted</th>
                <th className="px-5 py-2 text-center">Meetings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dormant.map((row) => (
                <tr key={row.userId} className="hover:bg-gray-50">
                  <td className="px-5 py-2 font-mono text-xs text-gray-600">{row.userId.slice(0, 8)}…</td>
                  <td className="px-5 py-2 text-center">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {row.score}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-center text-xs">{row.signals.recentLogin ? '✓' : '—'}</td>
                  <td className="px-5 py-2 text-center text-xs">{row.signals.introsRequested}</td>
                  <td className="px-5 py-2 text-center text-xs">{row.signals.introsAccepted}</td>
                  <td className="px-5 py-2 text-center text-xs">{row.signals.meetingsAttended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
