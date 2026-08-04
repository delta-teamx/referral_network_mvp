'use client';

import { useEffect, useState } from 'react';
import { Headset, Paperclip, Send, Trash2 } from 'lucide-react';
import { api, ApiError, apiBaseUrl } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { onSocketEvent } from '../../../../lib/socket';

/**
 * Admin - Support tickets. Every widget conversation lands here. Reply to
 * the visitor live, mark tickets answered/closed. Polls so new messages
 * appear while the console is open.
 */

interface TicketMessage {
  id: string;
  senderType: 'user' | 'agent' | 'system' | 'roul';
  body: string;
  createdAt: string;
}

interface TicketSummary {
  id: string;
  name: string;
  email: string;
  topic: string;
  status: string;
  priority?: boolean;
  humanTakeover?: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  messages: { senderType: string; body: string; createdAt: string }[];
}

interface TicketDetail extends Omit<TicketSummary, 'messages'> {
  messages: TicketMessage[];
}

/** Message text with URLs rendered as friendly links (attachments etc.). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="underline">
            {part.includes('/attachments/file') ? 'Open attachment →' : part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const STATUS_TONE: Record<string, string> = {
  open: 'bg-rose-500/15 text-rose-400',
  pending: 'bg-amber-500/15 text-amber-400',
  closed: 'bg-gray-500/15 text-gray-400',
};

export default function AdminSupportPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [filter, setFilter] = useState<'priority' | 'open' | 'pending' | 'closed' | 'all'>('open');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<TicketDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadList() {
    if (!accessToken) return;
    try {
      const data = await api.get<TicketSummary[]>('/api/v1/support/admin/tickets', {
        accessToken,
        // "Priority" is a cross-status view of admin-initiated ROUL threads.
        query: filter === 'priority' ? { status: 'all', priority: 'true' } : { status: filter },
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
      const t = await api.get<TicketDetail>(`/api/v1/support/tickets/${id}`, { accessToken });
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
    // Realtime is the fast path now; keep a slow poll as a reconnect safety net.
    const timer = setInterval(() => void loadThread(activeId), 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, accessToken]);

  // C5: live support updates - refresh the list on any ticket change, and the
  // open thread when it's the one that changed.
  useEffect(() => {
    const off = onSocketEvent<{ ticketId: string }>('support:message', (evt) => {
      void loadList();
      if (evt?.ticketId && evt.ticketId === activeId) void loadThread(activeId);
    });
    return off;
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

  async function sendAttachment(file: File) {
    if (!accessToken || !activeId) return;
    setUploading(true);
    setError(null);
    try {
      const contentType = file.type || 'application/octet-stream';
      const uploadUrl =
        `${apiBaseUrl()}/api/v1/support/tickets/${activeId}/attachments/upload` +
        `?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(contentType)}`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
        body: file,
        credentials: 'include',
      });
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: { key: string }; error?: string }
        | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new ApiError(json?.error ?? `Upload failed (${res.status})`, res.status);
      }
      const fileUrl = `${apiBaseUrl()}/api/v1/messages/attachments/file?key=${encodeURIComponent(json.data.key)}`;
      const t = await api.post<TicketDetail>(
        `/api/v1/support/admin/tickets/${activeId}/reply`,
        { text: `📎 ${file.name}: ${fileUrl}` },
        { accessToken },
      );
      setActive(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the file');
    } finally {
      setUploading(false);
    }
  }

  /** Irreversible: removes the ticket, its thread and its stored files. */
  async function deleteTicket() {
    if (!accessToken || !activeId || !active) return;
    if (
      !window.confirm(
        `PERMANENTLY delete the ticket from ${active.name}?\n\nThe whole thread and any attached files are removed from the database and storage. This cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`/api/v1/support/admin/tickets/${activeId}`, { accessToken });
      setActive(null);
      setActiveId(null);
      void loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
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

  // C1: take a ticket over from ROUL (pauses AI auto-replies) or hand it back.
  async function toggleTakeover(take: boolean) {
    if (!accessToken || !activeId) return;
    try {
      await api.post(
        `/api/v1/support/admin/tickets/${activeId}/${take ? 'takeover' : 'release'}`,
        {},
        { accessToken },
      );
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
          Every widget conversation from the site and dashboard, plus Priority threads you start
          with members from the Users tab. Members reply here and you get back to them. Online 24/7.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(['priority', 'open', 'pending', 'closed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f
                ? f === 'priority'
                  ? 'bg-blue-500 text-white'
                  : 'bg-amber-500 text-gray-950'
                : f === 'priority'
                  ? 'border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:border-blue-400'
                  : 'border border-gray-700 bg-gray-900 text-gray-300 hover:border-amber-500'
            }`}
          >
            {f === 'priority' ? '★ Priority' : f}
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
                        <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-white">
                          {t.priority && (
                            <span className="shrink-0 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-300">
                              ★ Priority
                            </span>
                          )}
                          <span className="truncate">{t.name}</span>
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[t.status] ?? ''}`}
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
                <div className="flex items-center gap-1.5">
                  {active.humanTakeover ? (
                    <button
                      onClick={() => void toggleTakeover(false)}
                      title="Hand this conversation back to ROUL (AI)"
                      className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-blue-500"
                    >
                      ● You’ve taken over · Release to ROUL
                    </button>
                  ) : (
                    <button
                      onClick={() => void toggleTakeover(true)}
                      title="Take over from ROUL — the AI stops auto-replying and you answer in this thread"
                      className="rounded-full border border-blue-500/50 px-3 py-1 text-[10px] font-semibold text-blue-300 transition hover:bg-blue-600 hover:text-white"
                    >
                      Take over from ROUL
                    </button>
                  )}
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
                  <button
                    onClick={() => void deleteTicket()}
                    title="Permanently delete this ticket and its files"
                    className="rounded-full bg-red-600 p-1.5 text-white transition hover:bg-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
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
                          : m.senderType === 'roul'
                            ? 'rounded-bl-sm border border-blue-500/40 bg-gray-800 text-gray-100'
                            : 'rounded-bl-sm bg-gray-800 text-gray-100'
                    }`}
                  >
                    {m.senderType === 'roul' && (
                      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-400">
                        ROUL (AI)
                      </p>
                    )}
                    <Linkified text={m.body} />
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
                <label
                  className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-700 text-gray-400 transition hover:border-amber-500 hover:text-amber-400 ${uploading ? 'animate-pulse' : ''}`}
                  title="Attach a file for the visitor"
                >
                  <Paperclip size={14} />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void sendAttachment(f);
                    }}
                  />
                </label>
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
