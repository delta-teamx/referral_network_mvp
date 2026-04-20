'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Check, Clock, Users, Video } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

interface NetEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMin: number;
  zoomUrl: string | null;
  maxAttendees: number;
  status: string;
  _count: { registrations: number };
}

export default function EventsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<NetEvent[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<NetEvent[]>('/api/v1/events/upcoming');
      setEvents(data);
      if (accessToken) {
        try {
          const mine = await api.get<NetEvent[]>('/api/v1/events/me/registrations', {
            accessToken: accessToken ?? undefined,
          });
          setRegistered(new Set(mine.map((e) => e.id)));
        } catch {
          /* silent */
        }
      }
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

  async function register(id: string) {
    if (!accessToken) return;
    setBusy(id);
    try {
      await api.post(`/api/v1/events/${id}/register`, {}, { accessToken: accessToken ?? undefined });
      setRegistered((s) => new Set([...s, id]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Register failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Live networking
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Scheduled Zoom networking events
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Weekly sessions, referral rooms, expert panels. Register to save your seat and
            get the Zoom link emailed to you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-900">No events scheduled yet</p>
            <p className="mt-1 text-sm text-gray-600">
              Admins will post recurring Zoom sessions here. Check back soon.
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-5 md:grid-cols-2"
          >
            {events.map((e) => {
              const isReg = registered.has(e.id);
              const pct = Math.round((e._count.registrations / e.maxAttendees) * 100);
              return (
                <motion.div
                  key={e.id}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{e.title}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      {e._count.registrations}/{e.maxAttendees}
                    </span>
                  </div>
                  {e.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-gray-600">{e.description}</p>
                  )}
                  <p className="mb-3 inline-flex items-center gap-1 text-sm text-gray-700">
                    <Clock size={14} className="text-primary" />
                    {new Date(e.startsAt).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    <span className="text-gray-400">· {e.durationMin} min</span>
                  </p>
                  <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {user ? (
                    isReg ? (
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/5 px-4 py-1.5 text-xs font-semibold text-success">
                          <Check size={12} /> Registered
                        </span>
                        {e.zoomUrl && (
                          <a
                            href={e.zoomUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                          >
                            <Video size={12} /> Zoom link
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => void register(e.id)}
                        disabled={busy === e.id || e._count.registrations >= e.maxAttendees}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Users size={12} />
                        {busy === e.id ? 'Registering…' : 'Register'}
                      </button>
                    )
                  ) : (
                    <Link
                      href={`/login?next=/events`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Log in to register →
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>
    </main>
  );
}
