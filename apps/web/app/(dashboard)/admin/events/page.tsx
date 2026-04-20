'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Calendar, Plus, Video, X } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { Button } from '../../../../components/ui/Button';
import { FormField } from '../../../../components/ui/FormField';

interface NetEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMin: number;
  zoomUrl: string | null;
  maxAttendees: number;
  status: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  _count: { registrations: number };
}

export default function AdminEventsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [events, setEvents] = useState<NetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<NetEvent[]>('/api/v1/events/admin/all', {
        accessToken: accessToken ?? undefined,
      });
      setEvents(data);
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

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setCreating(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(
        '/api/v1/events',
        {
          title: String(form.get('title') ?? ''),
          description: String(form.get('description') ?? '') || undefined,
          startsAt: new Date(String(form.get('startsAt'))).toISOString(),
          durationMin: Number(form.get('durationMin') ?? 60),
          maxAttendees: Number(form.get('maxAttendees') ?? 100),
          isRecurring: form.get('isRecurring') === 'on',
          recurrenceRule:
            form.get('isRecurring') === 'on' ? String(form.get('recurrenceRule') ?? '') : undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function cancel(id: string) {
    if (!accessToken) return;
    if (!window.confirm('Cancel this event? Registrants will be notified.')) return;
    try {
      await api.post(`/api/v1/events/${id}/cancel`, {}, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cancel failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Events</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Networking events{' '}
            <span className="text-sm font-normal text-gray-400">({events.length})</span>
          </h1>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400"
        >
          <Plus size={14} /> {formOpen ? 'Cancel' : 'New event'}
        </button>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {formOpen && (
        <form
          onSubmit={create}
          className="mb-6 space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5"
        >
          <FormField label="Title" name="title" required className="text-gray-100" />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Description</label>
            <textarea
              name="description"
              rows={2}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Start</label>
              <input
                type="datetime-local"
                name="startsAt"
                required
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100"
              />
            </div>
            <FormField label="Duration (min)" name="durationMin" type="number" defaultValue="60" />
            <FormField label="Max attendees" name="maxAttendees" type="number" defaultValue="100" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" name="isRecurring" /> Recurring
          </label>
          <FormField label="Recurrence rule (e.g. FREQ=WEEKLY;BYDAY=TU)" name="recurrenceRule" />
          <Button type="submit" loading={creating}>
            Create event + provision Zoom
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No events yet. Create your first one above.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{e.title}</p>
                    {e.isRecurring && (
                      <span className="text-xs text-amber-400">↻ recurring</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(e.startsAt).toLocaleString()} · {e.durationMin}min
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {e._count.registrations} / {e.maxAttendees}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        e.status === 'scheduled'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : e.status === 'canceled'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {e.zoomUrl && (
                        <a
                          href={e.zoomUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
                        >
                          <Video size={10} /> Zoom
                        </a>
                      )}
                      {e.status !== 'canceled' && (
                        <button
                          onClick={() => void cancel(e.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                        >
                          <X size={10} /> Cancel
                        </button>
                      )}
                    </div>
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
