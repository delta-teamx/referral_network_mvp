'use client';

import { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface AdminListing {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  status: string;
  isVerified: boolean;
  isFeatured: boolean;
  avgRating: string | number;
  reviewCount: number;
  trustScore: string | number;
  createdAt: string;
  user: { email: string; firstName: string; lastName: string };
}

export default function AdminListingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<{ listings: AdminListing[]; total: number }>(
        '/api/v1/admin/listings',
        {
          query: { q: q || undefined, limit: 50 },
          accessToken: accessToken ?? undefined,
        },
      );
      setListings(data.listings);
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

  async function toggleFeature(id: string, current: boolean) {
    if (!accessToken) return;
    try {
      await api.post(
        `/api/v1/admin/listings/${id}/feature`,
        { featured: !current },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Listings</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            All listings{' '}
            <span className="text-sm font-normal text-gray-400">({total.toLocaleString()})</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
          <Search size={14} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or city…"
            className="w-64 bg-transparent text-sm text-gray-100 outline-none"
          />
        </div>
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
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Trust</th>
              <th className="px-4 py-3 text-right">Feature</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="border-t border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <a
                      href={`/listing/${l.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-white hover:text-amber-400"
                    >
                      {l.name}
                    </a>
                    <p className="text-xs text-gray-500">
                      {l.city}, {l.state}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {l.user.firstName} {l.user.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        l.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : l.status === 'PENDING_REVIEW'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {Number(l.avgRating).toFixed(1)}
                    <span className="text-xs text-gray-500"> ({l.reviewCount})</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{Number(l.trustScore).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void toggleFeature(l.id, l.isFeatured)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                        l.isFeatured
                          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                          : 'border border-gray-700 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Sparkles size={12} />
                      {l.isFeatured ? 'Featured' : 'Feature'}
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
