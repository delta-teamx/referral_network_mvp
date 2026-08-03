'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, CheckCheck, MessageSquare, Paperclip, Send, ShieldCheck, Smile } from 'lucide-react';
import { api, ApiError, apiBaseUrl } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { onSocketEvent, emitSocket } from '../../../../lib/socket';
import { EmojiPicker } from '../../../../components/messages/EmojiPicker';

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
  isOfficial?: boolean;
  otherLastReadAt?: string | null;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

/** Server payloads. */
interface NewMessageEvent {
  conversationId: string;
  message: Message;
}
interface ReadEvent {
  conversationId: string;
  readerId: string;
  readAt: string;
}
interface DeliveredEvent {
  conversationId: string;
  messageId: string;
}
interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
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
  // ?c=<conversationId> - set when arriving from a member profile's Message
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

  // Realtime state
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [peerTyping, setPeerTyping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Keep the latest activeId available inside socket handlers without
  // resubscribing on every conversation switch.
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  // Scroll bookkeeping: whether the next render should stick to the bottom, and
  // the height captured before prepending older history (to preserve position).
  const stickBottom = useRef(true);
  const prevScrollHeight = useRef<number | null>(null);
  // Typing-emit throttling.
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load conversations -------------------------------------------------

  const loadConversations = useCallback(async () => {
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
      // empty panel) - show the message + status so it's self-diagnosing.
      setListError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (status ${err.status})` : ''}`
          : 'Could not load conversations',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // ---- Auto-open a conversation -------------------------------------------
  // Prefer the one passed via ?c= (from a profile's Message button);
  // otherwise open the most recent so the page is never an empty pane.
  // On phones the list IS the first screen, so only ?c= auto-opens there -
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
  // Loads the newest page and marks the thread read. Realtime keeps it live
  // after that; a slow poll stays as a safety net for reconnect gaps.

  const loadNewest = useCallback(async () => {
    if (!accessToken || !activeId) return;
    try {
      const data = await api.get<{ messages: Message[]; hasMore: boolean; otherLastReadAt: string | null }>(
        `/api/v1/messages/${activeId}/messages`,
        { accessToken: accessToken ?? undefined },
      );
      stickBottom.current = true;
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setOtherLastReadAt(data.otherLastReadAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load messages');
    }
  }, [accessToken, activeId]);

  useEffect(() => {
    if (!accessToken || !activeId) return;
    let cancelled = false;
    setDeliveredIds(new Set());
    setPeerTyping(false);
    void (async () => {
      await loadNewest();
      if (cancelled) return;
    })();
    // Mark read on open (server also emits a read receipt to the other side).
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
    // Safety-net poll (realtime is the primary path, so this is slow).
    const poll = setInterval(() => void loadNewest(), 45_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [accessToken, activeId, loadNewest]);

  // ---- Infinite scroll: load older history on scroll-up -------------------

  const loadOlder = useCallback(async () => {
    if (!accessToken || !activeId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const oldest = messages[0]!;
    const el = scrollRef.current;
    prevScrollHeight.current = el ? el.scrollHeight : null;
    try {
      const data = await api.get<{ messages: Message[]; hasMore: boolean; otherLastReadAt: string | null }>(
        `/api/v1/messages/${activeId}/messages`,
        { accessToken: accessToken ?? undefined, query: { before: oldest.createdAt } },
      );
      stickBottom.current = false;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const older = data.messages.filter((m) => !seen.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(data.hasMore);
    } catch {
      /* silent - user can scroll again to retry */
    } finally {
      setLoadingOlder(false);
    }
  }, [accessToken, activeId, hasMore, loadingOlder, messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60 && hasMore && !loadingOlder) void loadOlder();
  }

  // Keep scroll pinned to bottom for new messages; preserve position when
  // older history is prepended.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeight.current != null) {
      el.scrollTop += el.scrollHeight - prevScrollHeight.current;
      prevScrollHeight.current = null;
    } else if (stickBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  // ---- Realtime subscriptions ---------------------------------------------
  // Subscribed once; handlers read the live activeId via a ref so switching
  // threads doesn't churn listeners.
  useEffect(() => {
    if (!accessToken || !user) return;
    const me = user.id;

    const offNew = onSocketEvent<NewMessageEvent>('message:new', (evt) => {
      if (!evt?.message) return;
      const isActive = evt.conversationId === activeIdRef.current;
      if (isActive) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === evt.message.id)) return prev;
          // A message from the other person, or my own echo from another tab.
          const el = scrollRef.current;
          const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          stickBottom.current = evt.message.senderId === me || nearBottom;
          return [...prev, evt.message];
        });
        if (evt.message.senderId !== me) {
          // Ack delivery + mark the thread read since it's on screen.
          emitSocket('message:ack', { conversationId: evt.conversationId, messageId: evt.message.id });
          void api
            .post(`/api/v1/messages/${evt.conversationId}/read`, {}, { accessToken: accessToken ?? undefined })
            .catch(() => undefined);
          setPeerTyping(false);
        }
      }
      // Update the sidebar preview + unread state for every thread.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === evt.conversationId
            ? {
                ...c,
                lastMessage: {
                  id: evt.message.id,
                  senderId: evt.message.senderId,
                  text: evt.message.text,
                  createdAt: evt.message.createdAt,
                },
                updatedAt: evt.message.createdAt,
                unread: c.id === activeIdRef.current ? false : evt.message.senderId !== me,
              }
            : c,
        ),
      );
    });

    const offRead = onSocketEvent<ReadEvent>('message:read', (evt) => {
      if (evt.readerId === me) return;
      if (evt.conversationId === activeIdRef.current) setOtherLastReadAt(evt.readAt);
      setConversations((prev) =>
        prev.map((c) => (c.id === evt.conversationId ? { ...c, otherLastReadAt: evt.readAt } : c)),
      );
    });

    const offDelivered = onSocketEvent<DeliveredEvent>('message:delivered', (evt) => {
      if (evt.conversationId !== activeIdRef.current) return;
      setDeliveredIds((prev) => {
        if (prev.has(evt.messageId)) return prev;
        const next = new Set(prev);
        next.add(evt.messageId);
        return next;
      });
    });

    const offTyping = onSocketEvent<TypingEvent>('typing', (evt) => {
      if (evt.userId === me || evt.conversationId !== activeIdRef.current) return;
      setPeerTyping(evt.isTyping);
      if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
      if (evt.isTyping) {
        // Auto-clear in case the stop event is dropped.
        peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 5_000);
      }
    });

    return () => {
      offNew();
      offRead();
      offDelivered();
      offTyping();
    };
  }, [accessToken, user]);

  // ---- Typing emit --------------------------------------------------------

  function emitTyping() {
    if (!activeId) return;
    const now = Date.now();
    // Throttle "start" pings to at most one per ~1.5s.
    if (now - lastTypingEmit.current > 1_500) {
      lastTypingEmit.current = now;
      emitSocket('typing', { conversationId: activeId, isTyping: true });
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      emitSocket('typing', { conversationId: activeId, isTyping: false });
      lastTypingEmit.current = 0;
    }, 2_000);
  }

  function stopTyping() {
    if (!activeId) return;
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    lastTypingEmit.current = 0;
    emitSocket('typing', { conversationId: activeId, isTyping: false });
  }

  // ---- Send message -------------------------------------------------------

  async function handleSend() {
    if (!accessToken || !activeId || !draft.trim()) return;
    setSending(true);
    stopTyping();
    try {
      const msg = await api.post<Message>(
        `/api/v1/messages/${activeId}/messages`,
        { text: draft.trim() },
        { accessToken: accessToken ?? undefined },
      );
      stickBottom.current = true;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
      stickBottom.current = true;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
      // Upload THROUGH our API (same trusted origin as every other call) -
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
      stickBottom.current = true;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
      stickBottom.current = true;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite');
    } finally {
      setSending(false);
    }
  }

  // ---- Helpers ------------------------------------------------------------

  const activeConversation = conversations.find((c) => c.id === activeId);
  // Free members can always see & reply to official ROUL Support threads;
  // member-to-member messaging stays a Pro feature.
  const isPaid =
    user?.role === 'ADMIN' ||
    user?.subscriptionTier === 'PRO' ||
    user?.subscriptionTier === 'PREMIUM';
  const visibleConversations = isPaid ? conversations : conversations.filter((c) => c.isOfficial);

  function selectConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    setError(null);
    setShowEmoji(false);
    setPeerTyping(false);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      setDraft((d) => d.slice(0, start) + emoji + d.slice(end));
      // Restore focus + caret after the inserted emoji.
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setDraft((d) => d + emoji);
    }
  }

  // The id of the last message I sent - only that bubble carries the receipt
  // label (Messenger-style), so the thread isn't littered with ticks.
  const myMessageIds = messages.filter((m) => m.senderId === user?.id).map((m) => m.id);
  const lastMineId = myMessageIds[myMessageIds.length - 1];

  /** Receipt state for one of my messages. */
  function receiptFor(m: Message): 'read' | 'delivered' | 'sent' {
    if (otherLastReadAt && new Date(m.createdAt) <= new Date(otherLastReadAt)) return 'read';
    if (deliveredIds.has(m.id)) return 'delivered';
    return 'sent';
  }

  // ---- Render -------------------------------------------------------------

  return (
    <>
    {/* On phones the fixed bottom tab bar (~3.5rem) would cover the composer's
        Send button - subtract it from the chat height below md. */}
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden md:h-[calc(100vh-3rem)]">
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
            Every conversation is a lead - find it on your Pipeline too.
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
        ) : visibleConversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {isPaid
              ? 'No conversations yet. Start one from a member’s profile.'
              : 'No messages yet. The Referral Nova team will reach you here.'}
          </div>
        ) : (
          <ul>
            {!isPaid && (
              <li className="mx-2 my-1 rounded-xl border border-primary/20 bg-primary-light/40 px-3 py-2 text-[11px] text-gray-600">
                Upgrade to Pro to message other members directly.{' '}
                <Link href="/dashboard/billing" className="font-semibold text-primary hover:underline">
                  See plans
                </Link>
              </li>
            )}
            {visibleConversations.map((c) => {
              const other = c.otherUser;
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectConversation(c.id)}
                    className={`mx-2 my-0.5 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50 ${
                      isActive ? 'bg-primary-light/50' : c.isOfficial ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {/* Avatar initials */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase text-white shadow-sm ${
                        c.isOfficial
                          ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                          : 'bg-gradient-to-br from-primary to-blue-500'
                      }`}
                    >
                      {c.isOfficial ? (
                        <ShieldCheck size={16} />
                      ) : other ? (
                        (other.firstName?.[0] ?? '') + (other.lastName?.[0] ?? '')
                      ) : (
                        '?'
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`flex items-center gap-1.5 truncate text-sm ${
                          c.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
                        }`}
                      >
                        {c.isOfficial ? 'ROUL Support' : other ? `${other.firstName} ${other.lastName}` : 'Unknown'}
                        {c.isOfficial && (
                          <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                            Admin
                          </span>
                        )}
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
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase text-white shadow-sm ${
                    activeConversation?.isOfficial
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                      : 'bg-gradient-to-br from-primary to-blue-500'
                  }`}
                >
                  {activeConversation?.isOfficial ? (
                    <ShieldCheck size={16} />
                  ) : activeConversation?.otherUser ? (
                    (activeConversation.otherUser.firstName?.[0] ?? '') +
                    (activeConversation.otherUser.lastName?.[0] ?? '')
                  ) : (
                    '?'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-gray-900">
                    {activeConversation?.isOfficial
                      ? 'ROUL Support'
                      : activeConversation?.otherUser
                        ? `${activeConversation.otherUser.firstName} ${activeConversation.otherUser.lastName}`
                        : 'Conversation'}
                    {activeConversation?.isOfficial && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                        Referral Nova team
                      </span>
                    )}
                  </p>
                  {peerTyping && (
                    <p className="text-[11px] font-medium text-primary">typing…</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Member-only actions are hidden on the official ROUL thread. */}
                {!activeConversation?.isOfficial && activeConversation?.otherUser && (
                  <a
                    href={`/dashboard/members/profile?id=${activeConversation.otherUser.id}`}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary hover:text-primary"
                  >
                    View profile
                  </a>
                )}
                {!activeConversation?.isOfficial && (
                  <button
                    onClick={() => void sendBookingInvite()}
                    disabled={sending}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    📅 Invite to book a call
                  </button>
                )}
              </div>
            </header>

            {/* Messages */}
            <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 py-4">
              {error && (
                <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {hasMore && (
                <div className="mb-3 flex justify-center">
                  <button
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="rounded-full border border-gray-200 bg-white px-4 py-1 text-xs font-medium text-gray-500 hover:border-primary hover:text-primary disabled:opacity-60"
                  >
                    {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                  </button>
                </div>
              )}
              {messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-400">
                  No messages yet. Say hello!
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const isMe = m.senderId === user?.id;
                    const receipt = isMe && m.id === lastMineId ? receiptFor(m) : null;
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
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isMe ? 'text-white/60' : 'text-gray-400'
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {receipt === 'read' && (
                              <span className="flex items-center gap-0.5 font-medium text-white">
                                <CheckCheck size={12} /> Read
                              </span>
                            )}
                            {receipt === 'delivered' && (
                              <span className="flex items-center gap-0.5 text-white/70">
                                <CheckCheck size={12} /> Delivered
                              </span>
                            )}
                            {receipt === 'sent' && (
                              <span className="flex items-center gap-0.5 text-white/70">
                                <Check size={12} /> Sent
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {peerTyping && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white px-4 py-3 shadow-sm">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <form
              method="post" onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="relative flex items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
            >
              {showEmoji && (
                <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />
              )}
              {/* Emoji picker toggle */}
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                title="Insert emoji"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 transition hover:border-primary hover:text-primary ${showEmoji ? 'text-primary' : 'text-gray-500'}`}
              >
                <Smile size={16} />
              </button>
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
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  emitTyping();
                }}
                onBlur={stopTyping}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter inserts a newline (WhatsApp/Messenger style).
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim() && !sending) void handleSend();
                  }
                }}
                placeholder="Type a message…  (Shift+Enter for a new line)"
                className="max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm leading-relaxed outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
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
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)] animate-pulse bg-gray-50" />}>
      <MessagesInner />
    </Suspense>
  );
}
