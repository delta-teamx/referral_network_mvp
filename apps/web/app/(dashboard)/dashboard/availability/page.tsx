'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Check, Clock, Plus, Trash2 } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

// api + ApiError re-exported for convenience
import { Button } from '../../../../components/ui/Button';

interface Window {
  id?: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function minToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hmToMin(s: string): number {
  const [h, m] = s.split(':').map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

export default function AvailabilityPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [windows, setWindows] = useState<Window[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Window[]>('/api/v1/bookings/my-availability', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setWindows(data);
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

  function addWindow() {
    setWindows((prev) => [...prev, { dayOfWeek: 1, startMin: 9 * 60, endMin: 17 * 60 }]);
  }

  function removeWindow(idx: number) {
    setWindows((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateWindow(idx: number, patch: Partial<Window>) {
    setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }

  async function save() {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.put<Window[]>(
        '/api/v1/bookings/my-availability',
        { windows },
        { accessToken: accessToken ?? undefined },
      );
      setWindows(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Availability
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">When can people book you?</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Set recurring weekly hours you&rsquo;re available for 30-min calls. Peers will see
          30-minute slots inside these windows on your profile&rsquo;s Book button.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          <Check size={14} /> Saved.
        </p>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
      ) : (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          {windows.length === 0 ? (
            <div className="py-8 text-center">
              <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="mb-4 text-sm text-gray-600">
                No availability set. Add a window to start accepting bookings.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {windows.map((w, i) => (
                <li key={i} className="flex flex-wrap items-center gap-3">
                  <select
                    value={w.dayOfWeek}
                    onChange={(e) => updateWindow(i, { dayOfWeek: Number(e.target.value) })}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {DAYS.map((d, idx) => (
                      <option key={idx} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                  </span>
                  <input
                    type="time"
                    value={minToHM(w.startMin)}
                    onChange={(e) => updateWindow(i, { startMin: hmToMin(e.target.value) })}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={minToHM(w.endMin)}
                    onChange={(e) => updateWindow(i, { endMin: hmToMin(e.target.value) })}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => removeWindow(i)}
                    className="ml-auto rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-danger"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={addWindow}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary"
            >
              <Plus size={14} /> Add window
            </button>
            <Button onClick={() => void save()} loading={saving}>
              Save availability
            </Button>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Booked calls auto-generate a Zoom link. You&rsquo;ll get an email with a calendar
            invite when someone books you.
          </p>
        </motion.div>
      )}

      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/dashboard/bookings" className="text-primary hover:underline">
          View my bookings →
        </Link>
      </div>
    </div>
  );
}
