'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Admin - Member messages. The other side of the "ROUL Support" threads admins
 * start from the Users tab: members reply in their Messages tab, and the team
 * answers here as ROUL. Polls so replies appear while the console is open.
 */

interface ThreadSummary {
  id: string;
  updatedAt: string;
  member: { id: string; name: string; email: string } | null;
  lastMessage: { senderId: string; text: string; createdAt: string } | null;
  unread: boolean;
}

interface ThreadMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  fromRoul: boolean;
}

interface ThreadDetail {
  id: string;
  member: { id: string; name: string; email: string } | null;
  messages: ThreadMessage[];
}

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

export default function AdminMemberMessagesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<ThreadDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadList() {
    if (!accessToken) return;
    try {
      const data = await api.get<ThreadSummary[]>('/api/v1/admin/roul-threads', { accessToken });
      setThreads(data);
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
      const t = await api.get<ThreadDetail>(`/api/v1/admin/roul-threads/${id}`, { accessToken });
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
  }, [accessToken]);

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
      const t = await api.post<ThreadDetail>(
        `/api/v1/admin/roul-threads/${activeId}/reply`,
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

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <ShieldCheck size={14} /> ROUL Support
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Member messages</h1>
        <p className="mt-1 text-sm text-gray-400">
          Direct ROUL threads with members. Start one from the Users tab; members reply in their
          Messages tab and you answer here as ROUL. Reminders and direct support only, never pipelines.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Thread list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl bg-gray-900" />
          ) : threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-500">
              No member messages yet. Start one from the Users tab with the Message button.
            </div>
          ) : (
            <ul className="space-y-2">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveId(t.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      activeId === t.id
                        ? 'border-blue-500 bg-gray-900'
                        : 'border-gray-800 bg-gray-900/60 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {t.member?.name ?? 'Unknown member'}
                      </p>
                      {t.unread && (
                        <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                          new reply
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-400">{t.member?.email}</p>
                    {t.lastMessage && (
                      <p className="mt-1 truncate text-xs text-gray-500">{t.lastMessage.text}</p>
                    )}
                    <p className="mt-1 text-[10px] text-gray-600">
                      {new Date(t.updatedAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="lg:col-span-3">
          {!active ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-gray-700 text-sm text-gray-500">
              Select a member to read and reply.
            </div>
          ) : (
            <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-3">
                <MessageSquare size={16} className="text-blue-400" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {active.member?.name ?? 'Unknown member'}{' '}
                    <span className="text-gray-500">· {active.member?.email}</span>
                  </p>
                  <p className="text-xs text-gray-400">You are replying as ROUL Support</p>
                </div>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.fromRoul
                        ? 'ml-auto rounded-br-sm bg-blue-500 text-white'
                        : 'rounded-bl-sm bg-gray-800 text-gray-100'
                    }`}
                  >
                    {m.fromRoul && (
                      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-100">
                        ROUL Support
                      </p>
                    )}
                    <Linkified text={m.text} />
                    <p className={`mt-1 text-[9px] ${m.fromRoul ? 'text-blue-100' : 'text-gray-500'}`}>
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
                  placeholder="Reply as ROUL Support…"
                  className="min-w-0 flex-1 rounded-full border border-gray-700 bg-gray-950 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => void reply()}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
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
