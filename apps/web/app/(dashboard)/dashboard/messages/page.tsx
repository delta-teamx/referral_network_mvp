'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ---- Load conversations -------------------------------------------------

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<Conversation[]>('/api/v1/messages', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setConversations(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // ---- Load messages for active conversation ------------------------------

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
    return () => {
      cancelled = true;
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

  // ---- Helpers ------------------------------------------------------------

  const activeConversation = conversations.find((c) => c.id === activeId);

  function selectConversation(id: string) {
    setActiveId(id);
    setMessages([]);
    setError(null);
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel — conversation list */}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="sticky top-0 border-b border-gray-100 bg-white p-4">
          <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MessageSquare size={18} className="text-primary" /> Messages
          </h1>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
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
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
                      isActive ? 'bg-primary-light/40' : ''
                    }`}
                  >
                    {/* Avatar initials */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
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

      {/* Right panel — message thread */}
      <section className="flex flex-1 flex-col bg-gray-50">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Select a conversation to start messaging
          </div>
        ) : (
          <>
            {/* Thread header */}
            <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
                {activeConversation?.otherUser
                  ? (activeConversation.otherUser.firstName?.[0] ?? '') +
                    (activeConversation.otherUser.lastName?.[0] ?? '')
                  : '?'}
              </div>
              <p className="font-semibold text-gray-900">
                {activeConversation?.otherUser
                  ? `${activeConversation.otherUser.firstName} ${activeConversation.otherUser.lastName}`
                  : 'Conversation'}
              </p>
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
                          className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                            isMe
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-800 shadow-sm'
                          }`}
                        >
                          <p>{m.text}</p>
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
              className="flex items-center gap-3 border-t border-gray-200 bg-white px-6 py-3"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
