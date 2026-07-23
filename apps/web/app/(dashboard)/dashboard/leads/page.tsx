'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  StickyNote,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Pipeline — a GHL-style kanban board. Every prospect (message lead, intro,
 * consumer lead, referral, booking, contract partner) is a card the member
 * drags between stages. Stage moves feed Analytics directly.
 */

const STAGES = [
  { key: 'new', label: 'New lead', dot: 'bg-sky-500', ring: 'border-sky-200' },
  { key: 'in_process', label: 'In process', dot: 'bg-blue-500', ring: 'border-blue-200' },
  { key: 'zoom_booked', label: 'Zoom booked', dot: 'bg-violet-500', ring: 'border-violet-200' },
  { key: 'follow_up', label: 'Follow-up', dot: 'bg-amber-500', ring: 'border-amber-200' },
  { key: 'signing_contract', label: 'Signing contract', dot: 'bg-orange-500', ring: 'border-orange-200' },
  { key: 'contract_signed', label: 'Contract signed', dot: 'bg-teal-500', ring: 'border-teal-200' },
  { key: 'won', label: 'Won 🏆', dot: 'bg-emerald-500', ring: 'border-emerald-200' },
  { key: 'lost', label: 'Lost', dot: 'bg-rose-500', ring: 'border-rose-200' },
  { key: 'dead', label: 'Dead lead', dot: 'bg-gray-400', ring: 'border-gray-200' },
] as const;
type StageKey = (typeof STAGES)[number]['key'];

const SOURCE_LABEL: Record<string, string> = {
  message: 'Message',
  intro: 'Intro',
  consumer: 'Consumer',
  referral: 'Referral',
  booking: 'Booking',
  contract: 'Contract',
  manual: 'Manual',
};

interface Card {
  id: string;
  contactUserId: string | null;
  name: string;
  email: string | null;
  source: string;
  stage: string;
  notes: string | null;
  stageUpdatedAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    memberProfile: { businessName: string; industry: string } | null;
  } | null;
}

interface IntroLead {
  id: string;
  status: string;
  reason: string;
  sender: { id: string; firstName: string; lastName: string };
  target: { id: string; firstName: string; lastName: string };
}

export default function PipelinePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [cards, setCards] = useState<Card[]>([]);
  const [introLeads, setIntroLeads] = useState<IntroLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [dragOver, setDragOver] = useState<StageKey | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [data, intros] = await Promise.all([
        api.get<Card[]>('/api/v1/pipeline', { accessToken }),
        api
          .get<IntroLead[]>('/api/v1/ai/suggestions', { accessToken })
          .catch(() => [] as IntroLead[]),
      ]);
      setCards(data);
      setIntroLeads(intros.filter((i) => i.status === 'requested' && i.target.id === user?.id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the pipeline.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respondIntro(id: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/ai/introductions/${id}/respond`, { action }, { accessToken });
      setIntroLeads((prev) => prev.filter((i) => i.id !== id));
      void load();
    } catch {
      /* board still works */
    }
  }

  async function moveCard(id: string, stage: StageKey) {
    if (!accessToken) return;
    const prev = cards;
    setCards((cs) =>
      cs.map((c) => (c.id === id ? { ...c, stage, stageUpdatedAt: new Date().toISOString() } : c)),
    );
    try {
      await api.patch(`/api/v1/pipeline/${id}`, { stage }, { accessToken });
    } catch (err) {
      setCards(prev);
      setError(err instanceof ApiError ? err.message : 'Could not move the card.');
    }
  }

  async function saveNotes(id: string, notes: string) {
    if (!accessToken) return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, notes } : c)));
    try {
      await api.patch(`/api/v1/pipeline/${id}`, { notes }, { accessToken });
    } catch {
      /* keep local edit */
    }
  }

  async function removeCard(id: string) {
    if (!accessToken) return;
    if (!window.confirm('Remove this card from your pipeline?')) return;
    setCards((cs) => cs.filter((c) => c.id !== id));
    try {
      await api.delete(`/api/v1/pipeline/${id}`, { accessToken });
    } catch {
      void load();
    }
  }

  async function addCard() {
    if (!accessToken || !addName.trim()) return;
    try {
      const card = await api.post<Card>(
        '/api/v1/pipeline',
        { name: addName.trim(), email: addEmail.trim() || undefined },
        { accessToken },
      );
      setCards((cs) => [card, ...cs]);
      setAddName('');
      setAddEmail('');
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the card.');
    }
  }

  const won = cards.filter((c) => c.stage === 'won').length;
  const open = cards.filter((c) => !['won', 'lost', 'dead'].includes(c.stage)).length;

  return (
    <div className="flex h-full flex-col p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pipeline</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Your leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every conversation, intro, referral and booking becomes a card. Drag cards between
            stages — Analytics updates with every move.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm sm:flex">
            <span className="text-gray-600">
              Open <strong className="text-gray-900">{open}</strong>
            </span>
            <span className="text-gray-600">
              Won <strong className="text-emerald-600">{won}</strong>
            </span>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus size={14} /> Add lead
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Lead name"
            className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <input
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            placeholder="Email (optional)"
            className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => void addCard()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Add
          </button>
          <button
            onClick={() => setShowAdd(false)}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Intro requests: accept to open a conversation + create the card */}
      {introLeads.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <UserCheck size={13} /> Intro requests ({introLeads.length})
          </h2>
          <ul className="space-y-2">
            {introLeads.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-light/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {i.sender.firstName} {i.sender.lastName} wants an intro
                  </p>
                  <p className="line-clamp-1 text-xs text-gray-600">{i.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void respondIntro(i.id, 'accept')}
                    className="rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => void respondIntro(i.id, 'decline')}
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

      {/* ── The board ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-72 w-64 shrink-0 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex-1 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
          <div className="flex min-h-[24rem] gap-3">
            {STAGES.map((stage) => {
              const stageCards = cards.filter((c) => c.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(stage.key);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === stage.key ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    if (dragId.current) void moveCard(dragId.current, stage.key);
                    dragId.current = null;
                  }}
                  className={`flex w-64 shrink-0 flex-col rounded-2xl border bg-gray-100/70 transition ${
                    dragOver === stage.key ? `${stage.ring} ring-2 ring-primary/40` : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.dot}`} />
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                      {stage.label}
                    </span>
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500">
                      {stageCards.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                    {stageCards.length === 0 && (
                      <p className="rounded-xl border border-dashed border-gray-300 px-3 py-4 text-center text-[11px] text-gray-400">
                        Drop a card here
                      </p>
                    )}
                    {stageCards.map((c) => (
                      <PipelineCardView
                        key={c.id}
                        card={c}
                        onDragStart={() => (dragId.current = c.id)}
                        onMove={(dir) => {
                          const idx = STAGES.findIndex((s) => s.key === c.stage);
                          const next = STAGES[idx + dir];
                          if (next) void moveCard(c.id, next.key);
                        }}
                        onStage={(s) => void moveCard(c.id, s)}
                        onNotes={(n) => void saveNotes(c.id, n)}
                        onDelete={() => void removeCard(c.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineCardView({
  card,
  onDragStart,
  onMove,
  onStage,
  onNotes,
  onDelete,
}: {
  card: Card;
  onDragStart: () => void;
  onMove: (dir: -1 | 1) => void;
  onStage: (s: StageKey) => void;
  onNotes: (notes: string) => void;
  onDelete: () => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(card.notes ?? '');
  const idx = STAGES.findIndex((s) => s.key === card.stage);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{card.name}</p>
          {card.contact?.memberProfile && (
            <p className="truncate text-[11px] text-gray-500">
              {card.contact.memberProfile.businessName}
            </p>
          )}
          {card.email && !card.contact && (
            <p className="truncate text-[11px] text-gray-500">{card.email}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          {SOURCE_LABEL[card.source] ?? card.source}
        </span>
      </div>

      {card.notes && !editingNotes && (
        <p className="mt-2 line-clamp-2 rounded-lg bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
          {card.notes}
        </p>
      )}
      {editingNotes && (
        <div className="mt-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-2 py-1 text-[11px] focus:border-primary focus:outline-none"
            placeholder="Notes…"
          />
          <button
            onClick={() => {
              onNotes(notes);
              setEditingNotes(false);
            }}
            className="mt-1 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-white"
          >
            Save note
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={() => onMove(-1)}
          disabled={idx <= 0}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          aria-label="Move to previous stage"
        >
          <ChevronLeft size={13} />
        </button>
        <select
          value={card.stage}
          onChange={(e) => onStage(e.target.value as StageKey)}
          className="min-w-0 flex-1 cursor-pointer rounded-md border border-gray-200 bg-white px-1 py-1 text-[11px] text-gray-700 focus:border-primary focus:outline-none"
        >
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => onMove(1)}
          disabled={idx >= STAGES.length - 1}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          aria-label="Move to next stage"
        >
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
        {card.contactUserId && (
          <Link
            href={`/dashboard/members/profile?id=${card.contactUserId}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
          >
            <ExternalLink size={10} /> Profile
          </Link>
        )}
        <button
          onClick={() => setEditingNotes((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800"
        >
          <StickyNote size={10} /> Note
        </button>
        <button
          onClick={onDelete}
          className="ml-auto rounded-md p-1 text-gray-300 hover:text-danger"
          aria-label="Delete card"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
