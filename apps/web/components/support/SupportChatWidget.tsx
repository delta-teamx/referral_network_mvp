'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Headset, Send, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

/**
 * Floating support chat — lives on the marketing site AND the dashboard
 * (desktop/tablet only; hidden on phones). A visitor describes their issue,
 * a ticket is opened instantly in the admin console's Support tickets tab,
 * and during live hours (9–5 ET, weekdays) a real person replies in-line.
 */

interface TicketMessage {
  id: string;
  senderType: 'user' | 'agent' | 'system';
  body: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  name: string;
  email: string;
  topic: string;
  status: string;
  online: boolean;
  messages: TicketMessage[];
}

const STORAGE_KEY = 'rn-support-ticket';

export function SupportChatWidget() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore an existing conversation + check live-hours status once opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await api.get<{ online: boolean }>('/api/v1/support/status');
        if (!cancelled) setOnline(s.online);
      } catch {
        /* widget still works */
      }
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        try {
          const t = await api.get<Ticket>(`/api/v1/support/tickets/${saved}`);
          if (!cancelled) setTicket(t);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Poll the thread while open so agent replies appear live.
  useEffect(() => {
    if (!open || !ticket) return;
    const timer = setInterval(() => {
      void api
        .get<Ticket>(`/api/v1/support/tickets/${ticket.id}`)
        .then((t) => setTicket(t))
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [open, ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [ticket?.messages.length, open]);

  async function startTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const t = await api.post<Ticket>(
        '/api/v1/support/tickets',
        {
          name: String(form.get('name') ?? '').trim(),
          email: String(form.get('email') ?? '').trim(),
          topic: String(form.get('topic') ?? '').trim(),
          message: String(form.get('message') ?? '').trim(),
        },
        { accessToken: accessToken ?? undefined },
      );
      setTicket(t);
      window.localStorage.setItem(STORAGE_KEY, t.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach support — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!ticket || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    try {
      const t = await api.post<Ticket>(`/api/v1/support/tickets/${ticket.id}/messages`, { text });
      setTicket(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Message failed — try again.');
      setDraft(text);
    }
  }

  return (
    // Desktop + tablet only — the widget never renders on phones.
    <div className="fixed bottom-5 right-5 z-50 hidden md:block">
      {open ? (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary to-blue-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Headset size={18} />
              <div>
                <p className="text-sm font-bold leading-tight">Referral Nova Support</p>
                <p className="flex items-center gap-1 text-[10px] text-white/80">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      online ? 'bg-emerald-300' : 'bg-amber-300'
                    }`}
                  />
                  {online === null ? 'Connecting…' : online ? 'Live now (9–5 ET)' : 'Back weekdays 9–5 ET'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 transition hover:bg-white/20"
              aria-label="Close support chat"
            >
              <X size={16} />
            </button>
          </div>

          {error && (
            <p className="border-b border-danger/20 bg-danger/5 px-4 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          {!ticket ? (
            /* ── New ticket form ─────────────────────────────────── */
            <form onSubmit={startTicket} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
              <p className="text-xs text-gray-600">
                Tell us who you are and what&rsquo;s going on — a real person will pick this up.
              </p>
              <input
                name="name"
                required
                defaultValue={user ? `${user.firstName} ${user.lastName}` : ''}
                placeholder="Your name"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <input
                name="email"
                type="email"
                required
                defaultValue={user?.email ?? ''}
                placeholder="Your email"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <select
                name="topic"
                required
                defaultValue=""
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="" disabled>
                  What do you need help with?
                </option>
                <option>Account & login</option>
                <option>Messages & conversations</option>
                <option>Bookings & Zoom calls</option>
                <option>Pipeline & leads</option>
                <option>Contracts & referrals</option>
                <option>Billing & plans</option>
                <option>Something else</option>
              </select>
              <textarea
                name="message"
                required
                rows={3}
                placeholder="Describe the issue…"
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? 'Opening ticket…' : 'Start chat'}
              </button>
            </form>
          ) : (
            /* ── Chat thread ─────────────────────────────────────── */
            <>
              <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-gray-50 p-3">
                {ticket.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      m.senderType === 'user'
                        ? 'ml-auto rounded-br-sm bg-primary text-white'
                        : m.senderType === 'agent'
                          ? 'rounded-bl-sm border border-gray-200 bg-white text-gray-800'
                          : 'rounded-bl-sm bg-primary-light/60 text-gray-700'
                    }`}
                  >
                    {m.senderType === 'agent' && (
                      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                        Support team
                      </p>
                    )}
                    {m.body}
                    <p
                      className={`mt-1 text-[9px] ${
                        m.senderType === 'user' ? 'text-white/70' : 'text-gray-400'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-gray-200 bg-white p-2.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-full border border-gray-200 px-3.5 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
                >
                  <Send size={12} /> Send
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:scale-105 hover:shadow-2xl"
          aria-label="Open support chat"
        >
          <Headset size={18} /> Support
        </button>
      )}
    </div>
  );
}
