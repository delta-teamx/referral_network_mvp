'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Clock, Video, X } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

interface Booking {
  id: string;
  reason: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  zoomUrl: string | null;
  createdAt: string;
  host: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    memberProfile: { businessName: string; industry: string } | null;
  };
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    memberProfile: { businessName: string; industry: string } | null;
  };
}

export default function BookingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<Booking[]>(
        filter === 'upcoming' ? '/api/v1/bookings/mine?upcoming=true' : '/api/v1/bookings/mine',
        { accessToken: accessToken ?? undefined },
      );
      setBookings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, filter]);

  async function cancel(id: string) {
    if (!accessToken) return;
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await api.post(`/api/v1/bookings/${id}/cancel`, {}, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cancel failed');
    }
  }

  return (
    <UpgradeGate feature="Zoom Bookings" requiredTier="PRO">
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Bookings</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Your calls</h1>
          <p className="mt-1 text-sm text-gray-500">Zoom links are generated automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Video size={14} /> Book a call
          </Link>
          <Link
            href="/dashboard/availability"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary"
          >
            <Calendar size={14} /> Set availability
          </Link>
        </div>
      </header>

      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setFilter('upcoming')}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            filter === 'upcoming'
              ? 'bg-primary text-white'
              : 'border border-gray-200 bg-white text-gray-700'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-4 py-1.5 text-sm transition ${
            filter === 'all'
              ? 'bg-primary text-white'
              : 'border border-gray-200 bg-white text-gray-700'
          }`}
        >
          All
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600">
            No bookings yet. Share your profile link or set availability to start taking calls.
          </p>
        </div>
      ) : (
        <motion.ul
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {bookings.map((b) => {
            const peer = b.host.id === user?.id ? b.guest : b.host;
            const isHost = b.host.id === user?.id;
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {peer.firstName} {peer.lastName}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        b.status === 'confirmed'
                          ? 'bg-success/10 text-success'
                          : b.status === 'canceled'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {b.status}
                    </span>
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      {b.reason.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {peer.memberProfile && (
                    <p className="text-xs text-gray-500">
                      {peer.memberProfile.businessName} · {peer.memberProfile.industry}
                    </p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-700">
                    <Clock size={12} />
                    {new Date(b.startsAt).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    <span className="text-gray-400">
                      ({isHost ? 'you are hosting' : 'you are joining'})
                    </span>
                  </p>
                  {b.notes && (
                    <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      {b.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {b.zoomUrl && b.status === 'confirmed' && (
                    <a
                      href={b.zoomUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      <Video size={12} /> Join Zoom
                    </a>
                  )}
                  {b.status === 'confirmed' && (
                    <button
                      onClick={() => void cancel(b.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
                    >
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
    </UpgradeGate>
  );
}
