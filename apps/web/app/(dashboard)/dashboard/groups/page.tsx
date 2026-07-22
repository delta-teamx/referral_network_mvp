'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Crown, MapPin, MessageSquare, Send, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface GroupMemberRow {
  id: string;
  role: string;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}
interface GroupEventRow {
  id: string;
  title: string;
  date: string;
  meetingUrl: string | null;
}
interface GroupDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  meetingSchedule: string | null;
  maxMembers: number;
  isPublic: boolean;
  members: GroupMemberRow[];
  events: GroupEventRow[];
  _count: { members: number };
}
interface MyGroup {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  memberCount: number;
  role: string;
}
interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

function GroupsInner() {
  const slug = useSearchParams().get('slug') ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);

  if (!slug) return <MyGroupsList accessToken={accessToken} />;
  return <GroupDetailView slug={slug} accessToken={accessToken} meId={me?.id ?? null} />;
}

function MyGroupsList({ accessToken }: { accessToken: string | null }) {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const data = await api.get<MyGroup[]>('/api/v1/groups/mine', {
          accessToken: accessToken ?? undefined,
        });
        setGroups(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Groups</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users size={22} /> My groups
          </h1>
          <p className="mt-1 text-sm text-gray-500">Your networking circles. Open one to see members and chat.</p>
        </div>
        <Link href="/groups" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          Browse all groups
        </Link>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={32} className="mx-auto mb-3 text-primary" />
          <h3 className="mb-1 text-lg font-semibold text-gray-900">You haven&rsquo;t joined a group yet</h3>
          <p className="mb-4 text-sm text-gray-600">Groups are local networking circles — join one to meet and refer.</p>
          <Link href="/groups" className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
            Browse groups →
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/groups?slug=${g.slug}`}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <p className="font-semibold text-gray-900">{g.name}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={11} /> {g.city}, {g.state}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  {g.memberCount} member{g.memberCount === 1 ? '' : 's'} · you are {g.role.toLowerCase()}
                </p>
                <span className="mt-4 inline-block text-sm font-semibold text-primary">Open group →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupDetailView({
  slug,
  accessToken,
  meId,
}: {
  slug: string;
  accessToken: string | null;
  meId: string | null;
}) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadGroup = useCallback(async () => {
    try {
      const data = await api.get<GroupDetail>(`/api/v1/groups/by-slug/${slug}`, {
        accessToken: accessToken ?? undefined,
      });
      setGroup(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Group not found');
    }
  }, [slug, accessToken]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  const isMember = !!group && !!meId && group.members.some((m) => m.user.id === meId);

  async function join() {
    if (!group || !accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v1/groups/${group.id}/join`, {}, { accessToken: accessToken ?? undefined });
      await loadGroup();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!group || !accessToken) return;
    if (!window.confirm('Leave this group?')) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/groups/${group.id}/leave`, {}, { accessToken: accessToken ?? undefined });
      await loadGroup();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not leave');
    } finally {
      setBusy(false);
    }
  }

  if (error && !group) {
    return (
      <div className="p-8">
        <Link href="/dashboard/groups" className="text-sm text-primary">← My groups</Link>
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      </div>
    );
  }
  if (!group) {
    return <div className="p-8"><div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Link href="/dashboard/groups" className="text-sm text-primary">← My groups</Link>

      <header className="mt-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin size={13} /> {group.city}, {group.state} · {group._count.members}/{group.maxMembers} members
            </p>
            {group.meetingSchedule && (
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <Calendar size={13} /> {group.meetingSchedule}
              </p>
            )}
          </div>
          {isMember ? (
            <button
              onClick={() => void leave()}
              disabled={busy}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
            >
              Leave group
            </button>
          ) : (
            <button
              onClick={() => void join()}
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              Join group
            </button>
          )}
        </div>
        {group.description && <p className="mt-3 text-sm text-gray-700">{group.description}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Chat */}
        <section className="order-2 lg:order-1">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <MessageSquare size={14} /> Group chat
          </h2>
          {isMember ? (
            <GroupChat groupId={group.id} accessToken={accessToken} meId={meId} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
              Join the group to see and post in the chat.
            </div>
          )}
        </section>

        {/* Roster + events */}
        <aside className="order-1 space-y-6 lg:order-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              <Users size={14} /> Members ({group.members.length})
            </h2>
            <ul className="space-y-2">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                      {m.user.firstName[0]}{m.user.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.user.firstName} {m.user.lastName}
                        {(m.role === 'LEADER' || m.role === 'CO_LEADER') && (
                          <Crown size={11} className="ml-1 inline text-amber-500" />
                        )}
                      </p>
                    </div>
                  </div>
                  {m.user.id !== meId && (
                    <Link href={`/dashboard/members/profile?id=${m.user.id}`} className="text-xs font-semibold text-primary hover:underline">
                      View
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {group.events.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <Calendar size={14} /> Upcoming
              </h2>
              <ul className="space-y-2">
                {group.events.map((e) => (
                  <li key={e.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-gray-900">{e.title}</p>
                    <p className="text-xs text-gray-500">{new Date(e.date).toLocaleString()}</p>
                    {e.meetingUrl && (
                      <a href={e.meetingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary">
                        Join link →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function GroupChat({
  groupId,
  accessToken,
  meId,
}: {
  groupId: string;
  accessToken: string | null;
  meId: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<ChatMessage[]>(`/api/v1/groups/${groupId}/messages`, {
        accessToken: accessToken ?? undefined,
      });
      setMessages(data);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not load chat');
    }
  }, [groupId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !accessToken) return;
    setSending(true);
    setErr(null);
    setText('');
    try {
      await api.post(`/api/v1/groups/${groupId}/messages`, { text: body }, { accessToken: accessToken ?? undefined });
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not send');
      setText(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-2xl border border-gray-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-400">No messages yet — start the conversation.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender.id === meId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {!mine && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">
                      {m.sender.firstName} {m.sender.lastName}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      {err && <p className="px-4 text-xs text-danger">{err}</p>}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-gray-100 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group…"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <Send size={14} /> Send
        </button>
      </form>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" /></div>}>
      <GroupsInner />
    </Suspense>
  );
}
