'use client';

import { useEffect, useState } from 'react';
import { Headset, Send } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Admin — Support tickets. Every widget conversation lands here. Reply to
 * the visitor live, mark tickets answered/closed. Polls so new messages
 * appear while the console is open.
 */

interface TicketMessage {
  id: string;
  senderType: 'user' | 'agent' | 'system';
  body: string;
  createdAt: string;
}

interface TicketSummary {
  id: string;
  name: string;
  email: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  messages: { senderType: string; body: string; createdAt: string }[];
}

interface TicketDetail extends Omit<TicketSummary, 'messages'> {
  messages: TicketMessage[];
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-rose-500/15 text-rose-400',
  pending: 'bg-amber-500/15 text-amber-400',
  closed: 'bg-gray-500/15 text-gray-400',
};

export default function AdminSupportPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<'open' | 'pending' | 'closed' | 'all'>('open');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<TicketDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadList() {
    if (!accessToken) return;
    try {
      const data = await api.get<TicketSummary[]>('/api/v1/support/admin/tickets', {
        accessToken,
        query: { status: filter },
      });
      setTickets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(id: string) {
    if (!accessToken) return;
    try {
      const t = await api.get<TicketDetail>(`/api/v1/support/tickets/${id}`);
      setActive(t);
    } catch {
      /* list still works */
    }
  }

  useEffect(() => {
    void loadList();
    const timer = setInterval(() => void loadList(), 10_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, filter]);

  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    const timer = setInterval(() => void loadThread(activeId), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, accessToken]);

  async function reply() {
    if (!accessToken || !activeId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    try {
      const t = await api.post<TicketDetail>(
        `/api/v1/support/admin/tickets/${activeId}/reply`,
        { text },
        { accessToken },
      );
      setActive(t);
      void loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reply failed');
      setDraft(text);
    }
  }

  async function setStatus(status: 'open' | 'pending' | 'closed') {
    if (!accessToken || !activeId) return;
    try {
      await api.patch(`/api/v1/support/admin/tickets/${activeId}`, { status }, { accessToken });
      void loadThread(activeId);
      void loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Headset size={14} /> Support
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Support tickets</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every widget conversation from the site and dashboard. Live hours: weekdays 9–5 ET.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        {(['open', 'pending', 'closed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f
                ? 'bg-amber-500 text-gray-950'
                : 'border border-gray-700 bg-gray-900 text-gray-300 hover:border-amber-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Ticket list ─────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl bg-gray-900" />
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">
              No {filter !== 'all' ? filter : ''} tickets.
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => {
                const last = t.messages[0];
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setActiveId(t.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        activeId === t.id
                          ? 'border-amber-500 bg-gray-900'
                          : 'border-gray-800 bg-gray-900/60 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{t.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[t.status] ?? ''}`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-gray-400">
                        {t.topic} · {t.email}
                      </p>
                      {last && (
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {last.senderType === 'agent' ? 'You: ' : ''}
                          {last.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-gray-600">
                        {new Date(t.updatedAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Thread ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          {!active ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
              Select a ticket to read and reply.
            </div>
          ) : (
            <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {active.name} <span className="text-gray-500">· {active.email}</span>
                  </p>
                  <p className="text-xs text-gray-400">{active.topic}</p>
                </div>
                <div className="flex gap-1.5">
                  {(['open', 'pending', 'closed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => void setStatus(s)}
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold capitalize transition ${
                        active.status === s
                          ? 'bg-amber-500 text-gray-950'
                          : 'border border-gray-700 text-gray-300 hover:border-amber-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.senderType === 'agent'
                        ? 'ml-auto rounded-br-sm bg-amber-500 text-gray-950'
                        : m.senderType === 'system'
                          ? 'rounded-bl-sm bg-gray-800 italic text-gray-400'
                          : 'rounded-bl-sm bg-gray-800 text-gray-100'
                    }`}
                  >
                    {m.body}
                    <p
                      className={`mt-1 text-[9px] ${
                        m.senderType === 'agent' ? 'text-gray-800' : 'text-gray-500'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-gray-800 p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void reply();
                    }
                  }}
                  placeholder="Reply as support…"
                  className="min-w-0 flex-1 rounded-full border border-gray-700 bg-gray-950 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={() => void reply()}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-gray-950 transition hover:bg-amber-400 disabled:opacity-40"
                >
                  <Send size={12} /> Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
