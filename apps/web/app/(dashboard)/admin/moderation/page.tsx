'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface PendingListing {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string };
  category: { name: string; slug: string };
}

export default function ModerationQueue() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [items, setItems] = useState<PendingListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<PendingListing[]>('/api/v1/admin/listings/pending', {
        accessToken: accessToken ?? undefined,
      });
      setItems(data);
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

  async function approve(id: string) {
    if (!accessToken) return;
    setBusy(id);
    try {
      await api.post(`/api/v1/admin/listings/${id}/approve`, {}, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!accessToken) return;
    const reason = window.prompt('Rejection reason?');
    if (!reason || reason.length < 3) return;
    setBusy(id);
    try {
      await api.post(
        `/api/v1/admin/listings/${id}/reject`,
        { reason },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reject failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Moderation</p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          Listings awaiting approval{' '}
          <span className="text-sm font-normal text-gray-400">({items.length})</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Auto-approval is off for new listings. Review content, verify category fit, and publish.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-900" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">
          <p>The queue is empty. Nice.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-5"
            >
              <div>
                <p className="font-semibold text-white">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.category.name} · {item.city}, {item.state} · by {item.user.firstName}{' '}
                  {item.user.lastName} ({item.user.email})
                </p>
                <p className="text-xs text-gray-500">
                  Submitted {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/listing/${item.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
                >
                  Preview
                </a>
                <button
                  onClick={() => void approve(item.id)}
                  disabled={busy === item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
                >
                  <Check size={12} /> Approve
                </button>
                <button
                  onClick={() => void reject(item.id)}
                  disabled={busy === item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-60"
                >
                  <X size={12} /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
