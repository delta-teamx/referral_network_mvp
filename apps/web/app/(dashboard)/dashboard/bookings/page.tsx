'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';
import { Button } from '../../../../components/ui/Button';

/**
 * Bookings — calendar + list of your Zoom calls, with availability setup
 * merged in (you set your hours where you see your calendar).
 */

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

interface AvailWindow {
  id?: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function minToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hmToMin(s: string): number {
  const [h, m] = s.split(':').map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

export default function BookingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'calendar' | 'list' | 'availability'>('calendar');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string>(dayKey(new Date()));

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<Booking[]>('/api/v1/bookings/mine', {
        accessToken: accessToken ?? undefined,
      });
      setBookings(data);
      setError(null);
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

  async function respond(id: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await api.post(
        `/api/v1/bookings/${id}/respond`,
        { action },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not respond');
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (b.status === 'canceled') continue;
      const k = dayKey(new Date(b.startsAt));
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    return map;
  }, [bookings]);

  const pendingForMe = bookings.filter((b) => b.status === 'pending' && b.host.id === user?.id);
  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(b.status) && new Date(b.endsAt) >= new Date())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));

  // Month grid: leading blanks + days.
  const grid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return cells;
  }, [month]);

  const todayKey = dayKey(new Date());
  const selectedBookings = byDay.get(selectedDay) ?? [];

  return (
    <UpgradeGate feature="Zoom Bookings" requiredTier="PRO">
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Calendar</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Bookings &amp; availability</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your Zoom calls on a calendar, booking requests to approve, and the weekly hours
            people can book you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Video size={14} /> Book a call
          </Link>
          <button
            disabled
            title="Google Calendar sync is coming soon"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-400"
          >
            <CalendarPlus size={14} /> Integrate Google Calendar
            <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
              Coming soon
            </span>
          </button>
        </div>
      </header>

      {/* View switcher */}
      <div className="mb-5 flex gap-2">
        {(
          [
            { key: 'calendar', label: 'Calendar', icon: Calendar },
            { key: 'list', label: 'Upcoming', icon: List },
            { key: 'availability', label: 'My availability', icon: Clock },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition ${
              view === t.key
                ? 'bg-primary text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Requests needing your answer — always on top */}
      {pendingForMe.length > 0 && (
        <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-800">
            Booking requests waiting for you ({pendingForMe.length})
          </h2>
          <ul className="space-y-2">
            {pendingForMe.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {b.guest.firstName} {b.guest.lastName}
                    <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {b.reason.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(b.startsAt).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void respond(b.id, 'accept')}
                    className="rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => void respond(b.id, 'decline')}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
      ) : view === 'calendar' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Month grid ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelectedDay(dayKey(now));
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Today
                </button>
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400">
              {DAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                if (!d) return <div key={`blank-${i}`} />;
                const k = dayKey(d);
                const dayBookings = byDay.get(k) ?? [];
                const isToday = k === todayKey;
                const isSelected = k === selectedDay;
                return (
                  <button
                    key={k}
                    onClick={() => setSelectedDay(k)}
                    className={`flex min-h-16 flex-col items-stretch rounded-xl border p-1.5 text-left transition md:min-h-20 ${
                      isSelected
                        ? 'border-primary bg-primary-light/40 ring-1 ring-primary'
                        : 'border-gray-100 bg-white hover:border-primary/40'
                    }`}
                  >
                    <span
                      className={`mb-1 self-start rounded-full px-1.5 text-xs font-semibold ${
                        isToday ? 'bg-primary text-white' : 'text-gray-600'
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {dayBookings.slice(0, 2).map((b) => {
                        const peer = b.host.id === user?.id ? b.guest : b.host;
                        return (
                          <span
                            key={b.id}
                            className={`block truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight md:text-[10px] ${
                              b.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-primary/10 text-primary'
                            }`}
                          >
                            {new Date(b.startsAt).toLocaleTimeString('en-US', {
                              hour: 'numeric', minute: '2-digit',
                            })}{' '}
                            {peer.firstName}
                          </span>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <span className="block text-[9px] text-gray-400">
                          +{dayBookings.length - 2} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Selected day details ───────────────────────────────── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </h3>
            {selectedBookings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
                No calls this day.
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedBookings.map((b) => (
                  <BookingRow
                    key={b.id}
                    b={b}
                    meId={user?.id}
                    onRespond={respond}
                    onCancel={cancel}
                    compact
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : view === 'list' ? (
        upcoming.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-600">
              No upcoming calls. Book a member from their profile, or set your availability so
              people can book you.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} meId={user?.id} onRespond={respond} onCancel={cancel} />
            ))}
          </ul>
        )
      ) : (
        <AvailabilityEditor accessToken={accessToken} />
      )}
    </div>
    </UpgradeGate>
  );
}

function BookingRow({
  b,
  meId,
  onRespond,
  onCancel,
  compact = false,
}: {
  b: Booking;
  meId: string | undefined;
  onRespond: (id: string, action: 'accept' | 'decline') => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  compact?: boolean;
}) {
  const peer = b.host.id === meId ? b.guest : b.host;
  const isHost = b.host.id === meId;
  return (
    <li
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${
        compact ? 'p-3' : 'flex flex-wrap items-center justify-between gap-3 p-5'
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">
            {peer.firstName} {peer.lastName}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              b.status === 'confirmed'
                ? 'bg-success/10 text-success'
                : b.status === 'canceled'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {b.status}
          </span>
          <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
            {b.reason.replace(/_/g, ' ')}
          </span>
        </div>
        {peer.memberProfile && (
          <p className="text-xs text-gray-500">
            {peer.memberProfile.businessName} · {peer.memberProfile.industry}
          </p>
        )}
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-700">
          <Clock size={11} />
          {new Date(b.startsAt).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
          <span className="text-gray-400">({isHost ? 'hosting' : 'joining'})</span>
        </p>
        {b.notes && !compact && (
          <p className="mt-1 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">{b.notes}</p>
        )}
      </div>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? 'mt-2' : ''}`}>
        {b.status === 'pending' && isHost && (
          <>
            <button
              onClick={() => void onRespond(b.id, 'accept')}
              className="inline-flex items-center gap-1 rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => void onRespond(b.id, 'decline')}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
            >
              Decline
            </button>
          </>
        )}
        {b.status === 'pending' && !isHost && (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-semibold text-amber-800">
            Awaiting confirmation…
          </span>
        )}
        {b.zoomUrl && b.status === 'confirmed' && (
          <a
            href={b.zoomUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Video size={12} /> Join Zoom
          </a>
        )}
        {(b.status === 'confirmed' || (b.status === 'pending' && !isHost)) && (
          <button
            onClick={() => void onCancel(b.id)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
          >
            <X size={11} className="mr-0.5 inline" /> Cancel
          </button>
        )}
      </div>
    </li>
  );
}

/** Weekly availability editor — must be set before people can book you. */
function AvailabilityEditor({ accessToken }: { accessToken: string | null }) {
  const [windows, setWindows] = useState<AvailWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<AvailWindow[]>('/api/v1/bookings/my-availability', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setWindows(data);
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

  function validateWindows(ws: AvailWindow[]): string | null {
    for (const w of ws) {
      if (w.startMin < 0 || w.endMin > 1440 || w.startMin >= w.endMin) {
        return `${DAYS[w.dayOfWeek]} window has an invalid time range - end must be after start.`;
      }
      if (w.endMin - w.startMin < 30) {
        return `${DAYS[w.dayOfWeek]} window is shorter than 30 minutes.`;
      }
    }
    const byDay = new Map<number, AvailWindow[]>();
    for (const w of ws) {
      const arr = byDay.get(w.dayOfWeek) ?? [];
      arr.push(w);
      byDay.set(w.dayOfWeek, arr);
    }
    for (const [day, arr] of byDay) {
      const sorted = [...arr].sort((a, b) => a.startMin - b.startMin);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.startMin < sorted[i - 1]!.endMin) {
          return `${DAYS[day]} has overlapping windows. Merge or adjust them before saving.`;
        }
      }
    }
    return null;
  }

  async function save() {
    if (!accessToken) return;
    const validationError = validateWindows(windows);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.put<AvailWindow[]>(
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

  if (loading) return <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-gray-900">When can people book you?</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Recurring weekly hours for 30-min calls. Members see these as bookable slots on your
        profile. Set this up before sharing your calendar.
      </p>

      {error && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          <Check size={14} /> Saved.
        </p>
      )}

      {windows.length === 0 ? (
        <div className="py-6 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600">
            No availability set. Add a window to start accepting bookings.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {windows.map((w, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3">
              <select
                value={w.dayOfWeek}
                onChange={(e) =>
                  setWindows((prev) =>
                    prev.map((x, xi) => (xi === i ? { ...x, dayOfWeek: Number(e.target.value) } : x)),
                  )
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                {DAYS.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={minToHM(w.startMin)}
                onChange={(e) =>
                  setWindows((prev) =>
                    prev.map((x, xi) => (xi === i ? { ...x, startMin: hmToMin(e.target.value) } : x)),
                  )
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="time"
                value={minToHM(w.endMin)}
                onChange={(e) =>
                  setWindows((prev) =>
                    prev.map((x, xi) => (xi === i ? { ...x, endMin: hmToMin(e.target.value) } : x)),
                  )
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={() => setWindows((prev) => prev.filter((_, xi) => xi !== i))}
                className="ml-auto rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-danger"
                aria-label="Remove window"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() =>
            setWindows((prev) => [...prev, { dayOfWeek: 1, startMin: 9 * 60, endMin: 17 * 60 }])
          }
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary"
        >
          <Plus size={14} /> Add window
        </button>
        <Button onClick={() => void save()} loading={saving}>
          Save availability
        </Button>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Accepted bookings auto-generate a Zoom link, email both sides a calendar invite, and pop
        an in-app reminder shortly before the call.
      </p>
    </div>
  );
}
