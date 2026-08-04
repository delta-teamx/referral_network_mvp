'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Bot, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface Escalation {
  id: string;
  ticketId: string | null;
  name: string | null;
  email: string | null;
  stuckStep: string | null;
  transcript: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
interface KnowledgeChunk {
  id: string;
  title: string | null;
  content: string;
  source: string;
  updatedAt: string;
}

type Tab = 'escalations' | 'knowledge' | 'prompt';

export default function RoulConsolePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<Tab>('escalations');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Escalations ──
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Knowledge ──
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [kTitle, setKTitle] = useState('');
  const [kContent, setKContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingK, setSavingK] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // ── Prompt ──
  const [promptText, setPromptText] = useState('');
  const [promptDefault, setPromptDefault] = useState('');
  const [savingP, setSavingP] = useState(false);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [esc, kn, pr] = await Promise.all([
        api.get<Escalation[]>('/api/v1/admin/roul/escalations', { accessToken }),
        api.get<KnowledgeChunk[]>('/api/v1/admin/roul/knowledge', { accessToken }),
        api.get<{ instructions: string; default: string }>('/api/v1/admin/roul/prompt', { accessToken }),
      ]);
      setEscalations(esc);
      setChunks(kn);
      setPromptText(pr.instructions);
      setPromptDefault(pr.default);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the ROUL console');
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveEsc(id: string) {
    if (!accessToken) return;
    setEscalations((prev) => prev.map((e) => (e.id === id ? { ...e, resolvedAt: new Date().toISOString() } : e)));
    await api.post(`/api/v1/admin/roul/escalations/${id}/resolve`, {}, { accessToken }).catch(() => void load());
  }

  async function saveKnowledge(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !kContent.trim()) return;
    setSavingK(true);
    setError(null);
    try {
      await api.post(
        '/api/v1/admin/roul/knowledge',
        { id: editingId ?? undefined, title: kTitle.trim(), content: kContent.trim() },
        { accessToken },
      );
      setKTitle('');
      setKContent('');
      setEditingId(null);
      flash('Knowledge saved — ROUL will use it right away.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setSavingK(false);
    }
  }

  function editChunk(c: KnowledgeChunk) {
    setEditingId(c.id);
    setKTitle(c.title ?? '');
    setKContent(c.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteChunk(id: string) {
    if (!accessToken || !window.confirm('Delete this knowledge entry?')) return;
    setChunks((prev) => prev.filter((c) => c.id !== id));
    await api.delete(`/api/v1/admin/roul/knowledge/${id}`, { accessToken }).catch(() => void load());
  }

  async function resync() {
    if (!accessToken) return;
    setResyncing(true);
    try {
      const r = await api.post<{ synced: number; available: boolean; skipped?: boolean }>(
        '/api/v1/admin/roul/knowledge/resync',
        {},
        { accessToken },
      );
      flash(r.available ? `Re-synced ${r.synced} curated chunks.` : 'Vector store unavailable.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Re-sync failed');
    } finally {
      setResyncing(false);
    }
  }

  async function savePrompt() {
    if (!accessToken) return;
    setSavingP(true);
    try {
      await api.put('/api/v1/admin/roul/prompt', { text: promptText }, { accessToken });
      flash('System prompt saved (live within a minute).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the prompt');
    } finally {
      setSavingP(false);
    }
  }

  async function resetPrompt() {
    if (!accessToken) return;
    setPromptText(promptDefault);
    await api.put('/api/v1/admin/roul/prompt', { text: null }, { accessToken }).catch(() => undefined);
    flash('Reset to the default prompt.');
  }

  const openEscalations = escalations.filter((e) => !e.resolvedAt).length;

  const TABS: { key: Tab; label: string; icon: typeof Bot }[] = [
    { key: 'escalations', label: `Escalations${openEscalations ? ` (${openEscalations})` : ''}`, icon: AlertTriangle },
    { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { key: 'prompt', label: 'System prompt', icon: Bot },
  ];

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <Bot size={14} /> ROUL Console
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Manage your AI support agent</h1>
        <p className="mt-1 text-sm text-gray-400">
          Review escalations, edit ROUL’s knowledge and system prompt — all live, no deploy.
          Conversations &amp; takeover live in{' '}
          <a href="/admin/support" className="font-semibold text-blue-400 hover:underline">
            Support tickets
          </a>
          .
        </p>
      </header>

      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 flex gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'border border-gray-700 text-gray-300 hover:border-blue-500'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Escalations ── */}
      {tab === 'escalations' && (
        <div className="space-y-2">
          {escalations.length === 0 ? (
            <p className="text-sm text-gray-500">No escalations yet.</p>
          ) : (
            escalations.map((e) => (
              <div key={e.id} className={`rounded-xl border p-3 ${e.resolvedAt ? 'border-gray-800 bg-gray-900/50' : 'border-amber-500/40 bg-gray-900'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {e.name || 'Unknown'} <span className="text-gray-500">· {e.email || 'no email'}</span>
                    </p>
                    <p className="truncate text-xs text-gray-400">{e.stuckStep || '—'}</p>
                    <p className="text-[10px] text-gray-600">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="rounded-full border border-gray-700 px-3 py-1 text-[10px] text-gray-300 hover:border-blue-500">
                      {expanded === e.id ? 'Hide' : 'Transcript'}
                    </button>
                    {e.ticketId && (
                      <a href={`/admin/support?ticket=${e.ticketId}`} className="rounded-full border border-gray-700 px-3 py-1 text-[10px] text-blue-400 hover:border-blue-500">
                        Open ticket
                      </a>
                    )}
                    {e.resolvedAt ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400"><Check size={11} /> Resolved</span>
                    ) : (
                      <button onClick={() => void resolveEsc(e.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500">
                        Mark resolved
                      </button>
                    )}
                  </div>
                </div>
                {expanded === e.id && e.transcript && (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-3 text-[11px] text-gray-300">{e.transcript}</pre>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Knowledge ── */}
      {tab === 'knowledge' && (
        <div>
          <form onSubmit={saveKnowledge} className="mb-5 rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className="mb-2 text-sm font-semibold text-white">
              {editingId ? 'Edit knowledge' : 'Add knowledge'}
            </p>
            <input
              value={kTitle}
              onChange={(e) => setKTitle(e.target.value)}
              placeholder="Title (optional) — e.g. Refund policy"
              className="mb-2 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
            <textarea
              value={kContent}
              onChange={(e) => setKContent(e.target.value)}
              rows={4}
              placeholder="What should ROUL know? Write it as clear facts."
              className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <button type="submit" disabled={savingK || !kContent.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                <Plus size={14} /> {editingId ? 'Save changes' : 'Add'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setEditingId(null); setKTitle(''); setKContent(''); }} className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500">
                  Cancel
                </button>
              )}
              <button type="button" onClick={() => void resync()} disabled={resyncing} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-gray-700 px-4 py-2 text-xs text-gray-300 hover:border-blue-500 disabled:opacity-50" title="Re-embed the built-in curated knowledge">
                <RefreshCw size={13} className={resyncing ? 'animate-spin' : ''} /> Re-sync curated KB
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {chunks.length === 0 ? (
              <p className="text-sm text-gray-500">No knowledge chunks yet — add one above or re-sync the curated KB.</p>
            ) : (
              chunks.map((c) => (
                <div key={c.id} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      {c.title || '(untitled)'}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${c.source === 'admin' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>
                        {c.source}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{c.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => editChunk(c)} className="rounded-full border border-gray-700 px-2.5 py-1 text-[10px] text-gray-300 hover:border-blue-500">Edit</button>
                    <button onClick={() => void deleteChunk(c.id)} className="rounded-full p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── System prompt ── */}
      {tab === 'prompt' && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-1 text-sm font-semibold text-white">ROUL’s instructions</p>
          <p className="mb-3 text-xs text-gray-400">
            The persona + rules ROUL follows. The knowledge base is appended automatically — don’t
            paste facts here. Changes go live within a minute.
          </p>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={14}
            className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-100 outline-none focus:border-blue-500"
          />
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => void savePrompt()} disabled={savingP} className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              Save prompt
            </button>
            <button onClick={() => void resetPrompt()} className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-gray-500">
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
