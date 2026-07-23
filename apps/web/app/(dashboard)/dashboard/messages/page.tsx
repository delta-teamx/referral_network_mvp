'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageSquare, Paperclip, Send } from 'lucide-react';
import { api, ApiError, apiBaseUrl } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OtherUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface LastMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  updatedAt: string;
  otherUser: OtherUser | null;
  lastMessage: LastMessage | null;
  unread: boolean;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

/** Render message text with URLs as clickable links. */
function Linkified({ text, light }: { text: string; light: boolean }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className={`underline ${light ? 'text-white' : 'text-primary'}`}
          >
            {part.includes('/dashboard/members/profile')
              ? 'Book a time with me →'
              : part.includes('amazonaws.com/chat/') || part.includes('/attachments/file')
                ? 'Open attachment →'
                : part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function MessagesInner() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  // ?c=<conversationId> — set when arriving from a member profile's Message
  // button, so we open that lead's thread immediately.
  const preselectId = useSearchParams().get('c');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ---- Load conversations -------------------------------------------------

  async function loadConversations() {
    if (!accessToken) return;
    setLoading(true);
    setListError(null);
    try {
      const data = await api.get<Conversation[]>('/api/v1/messages', {
        accessToken: accessToken ?? undefined,
      });
      setConversations(data);
    } catch (err) {
      // A failed list load must be VISIBLE (it used to fail silently into an
      // empty panel) — show the message + status so it's self-diagnosing.
      setListError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (status ${err.status})` : ''}`
          : 'Could not load conversations',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ---- Auto-open a conversation -------------------------------------------
  // Prefer the one passed via ?c= (from a profile's Message button);
  // otherwise open the most recent so the page is never an empty pane.
  // On phones the list IS the first screen, so only ?c= auto-opens there —
  // and pressing Back must not immediately re-open the thread.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (loading || activeId || conversations.length === 0 || autoOpened.current) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
    const target =
      preselectId && conversations.some((c) => c.id === preselectId)
        ? preselectId
        : isDesktop
          ? conversations[0]!.id
          : null;
    if (target) {
      autoOpened.current = true;
      setActiveId(target);
    }
  }, [loading, activeId, conversations, preselectId]);

  // ---- Load messages for active conversation ------------------------------
  // Polls every 15s so replies appear without a manual refresh; marks the
  // conversation read on open.

  useEffect(() => {
    if (!accessToken || !activeId) return;
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Message[]>(`/api/v1/messages/${activeId}/messages`, {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setMessages(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load messages');
      }
    }
    void load();
    void api
      .post(`/api/v1/messages/${activeId}/read`, {}, { accessToken: accessToken ?? undefined })
      .then(() => {
        if (!cancelled) {
          setConversations((prev) =>
            prev.map((c) => (c.id === activeId ? { ...c, unread: false } : c)),
          );
        }
      })
      .catch(() => undefined);
    const poll = setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [accessToken, activeId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---- Send message -------------------------------------------------------

  async function handleSend() {
    if (!accessToken || !activeId || !draft.trim()) return;
    setSending(true);
    try {
      const msg = await api.post<Message>(
        `/api/v1/messages/${activeId}/messages`,
        { text: draft.trim() },
        { accessToken: accessToken ?? undefined },
      );
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      // Update last message in sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessage: {
                  id: msg.id,
                  senderId: msg.senderId,
                  text: msg.text,
                  createdAt: msg.createdAt,
                },
                updatedAt: msg.createdAt,
              }
            : c,
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  // ---- Quick send + attachments -------------------------------------------

  async function sendQuick(text: string) {
    if (!accessToken || !activeId) return;
    setSending(true);
    try {
      const msg = await api.post<Message>(
        `/api/v1/messages/${activeId}/messages`,
        { text },
        { accessToken: accessToken ?? undefined },
      );
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function sendAttachment(file: File) {
    if (!accessToken || !activeId) return;
    setUploading(true);
    setError(null);
    try {
      // Upload THROUGH our API (same trusted origin as every other call) —
      // no S3 bucket CORS or public-access settings involved.
      const contentType = file.type || 'application/octet-stream';
      const uploadUrl =
        `${apiBaseUrl()}/api/v1/messages/${activeId}/attachments/upload` +
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
      const msg = await api.post<Message>(
        `/api/v1/messages/${activeId}/messages`,
        { text: `📎 ${file.name}: ${fileUrl}` },
        { accessToken: accessToken ?? undefined },
      );
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload the file');
    } finally {
      setUploading(false);
    }
  }

  // ---- Booking invite ------------------------------------------------------
  // Drops a message with a link to MY profile so the other person can pick a
  // slot; their request then goes through the host-approval flow.

  async function sendBookingInvite() {
    if (!accessToken || !activeId || !user) return;
    setSending(true);
    try {
      const msg = await api.post<Message>(
        `/api/v1/messages/${activeId}/messages`,
        {
          text: `📅 Let's get on a call! Pick a time that works for you on my profile and I'll confirm it: https://dashboard.referralnova.com/dashboard/members/profile?id=${user.id}`,
        },
        { accessToken: accessToken ?? undefined },
      );
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite');
    } finally {
      setSending(false);
    }
  }

  // ---- Helpers ------------------------------------------------------------

  const activeConversation = conversations.find((c) => c.id === activeId);

  function selectConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    setError(null);
  }

  // ---- Render -------------------------------------------------------------

  return (
    <UpgradeGate feature="In-App Messaging" requiredTier="PRO">
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* Left panel - conversation list (on phones: hidden while a thread is open) */}
      <aside
        className={`w-full shrink-0 overflow-y-auto border-r border-gray-200 bg-white md:block md:w-80 ${
          activeId ? 'hidden' : 'block'
        }`}
      >
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 p-4 backdrop-blur">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MessageSquare size={18} className="text-primary" /> Messages
          </h1>
          <p className="mt-0.5 text-[11px] text-gray-400">
            Every conversation is a lead — find it on your Pipeline too.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : listError ? (
          <div className="p-6 text-center">
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {listError}
            </p>
            <button
              onClick={() => void loadConversations()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No conversations yet. Start one from a member&rsquo;s profile.
          </div>
        ) : (
          <ul>
            {conversations.map((c) => {
              const other = c.otherUser;
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectConversation(c.id)}
                    className={`mx-2 my-0.5 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50 ${
                      isActive ? 'bg-primary-light/50' : ''
                    }`}
                  >
                    {/* Avatar initials */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold uppercase text-white shadow-sm">
                      {other
                        ? (other.firstName?.[0] ?? '') + (other.lastName?.[0] ?? '')
                        : '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          c.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                        }`}
                      >
                        {other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                      </p>
                      {c.lastMessage && (
                        <p className="truncate text-xs text-gray-500">{c.lastMessage.text}</p>
                      )}
                    </div>
                    {c.unread && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Right panel - message thread (on phones: full screen with a Back button) */}
      <section className={`flex-1 flex-col bg-gray-50 md:flex ${activeId ? 'flex' : 'hidden'}`}>
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a conversation to start messaging
          </div>
        ) : (
          <>
            {/* Thread header */}
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setActiveId(null)}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold uppercase text-white shadow-sm">
                  {activeConversation?.otherUser
                    ? (activeConversation.otherUser.firstName?.[0] ?? '') +
                      (activeConversation.otherUser.lastName?.[0] ?? '')
                    : '?'}
                </div>
                <p className="truncate font-semibold text-gray-900">
                  {activeConversation?.otherUser
                    ? `${activeConversation.otherUser.firstName} ${activeConversation.otherUser.lastName}`
                    : 'Conversation'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeConversation?.otherUser && (
                  <a
                    href={`/dashboard/members/profile?id=${activeConversation.otherUser.id}`}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary hover:text-primary"
                  >
                    View profile
                  </a>
                )}
                <button
                  onClick={() => void sendBookingInvite()}
                  disabled={sending}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  📅 Invite to book a call
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {error && (
                <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">
                  No messages yet. Say hello!
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isMe = m.senderId === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm md:max-w-[70%] ${
                            isMe
                              ? 'rounded-br-md bg-gradient-to-br from-primary to-blue-600 text-white shadow-sm'
                              : 'rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
                          }`}
                        >
                          <p>
                            <Linkified text={m.text} light={isMe} />
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isMe ? 'text-white/60' : 'text-gray-400'
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
            >
              {/* Attach document / contract */}
              <label
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-primary hover:text-primary ${uploading ? 'animate-pulse' : ''}`}
                title="Attach a document or contract (PDF, Word, Excel, image)"
              >
                <Paperclip size={16} />
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
              {/* Thumbs up quick-send */}
              <button
                type="button"
                onClick={() => void sendQuick('👍')}
                disabled={sending}
                title="Send a thumbs up"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-lg transition hover:border-primary disabled:opacity-50"
              >
                👍
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                Send <Send size={14} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
    </UpgradeGate>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)] animate-pulse bg-gray-50" />}>
      <MessagesInner />
    </Suspense>
  );
}
