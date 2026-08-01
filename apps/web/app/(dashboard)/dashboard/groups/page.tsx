'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Crown,
  Link2,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Settings,
  Users,
  X,
} from 'lucide-react';
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
  // Closed-group access model (may be absent on older API responses).
  locked?: boolean;
  lockedInterior?: boolean;
  joinPolicy?: 'open' | 'request' | 'invite';
  pendingRequest?: boolean;
  viewerRole?: 'MEMBER' | 'LEADER' | 'CO_LEADER' | null;
  memberCount?: number;
  logoUrl?: string | null;
  primaryColor?: string | null;
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
interface PublicGroup {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  meetingSchedule: string | null;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
  joinPolicy?: 'open' | 'request' | 'invite';
  lockedInterior?: boolean;
}
interface ChatMessage {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

function GroupsInner() {
  const params = useSearchParams();
  const slug = params.get('slug') ?? '';
  const initialManage = params.get('view') === 'manage';
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);

  if (!slug) return <MyGroupsList accessToken={accessToken} />;
  return (
    <GroupDetailView
      slug={slug}
      accessToken={accessToken}
      meId={me?.id ?? null}
      initialManage={initialManage}
    />
  );
}

function MyGroupsList({ accessToken }: { accessToken: string | null }) {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [discover, setDiscover] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<Set<string>>(new Set());
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [mine, all] = await Promise.all([
        api.get<MyGroup[]>('/api/v1/groups/mine', { accessToken: accessToken ?? undefined }),
        api.get<PublicGroup[]>('/api/v1/groups', { query: { limit: 50 }, accessToken: accessToken ?? undefined }),
      ]);
      setGroups(mine);
      // Groups they can still act on: public, not already a member, not full.
      // Open groups get a one-tap join; request/closed groups get a "Request
      // to join" that opens the group so they can apply.
      const mineIds = new Set(mine.map((g) => g.id));
      setDiscover(all.filter((g) => g.isPublic && !mineIds.has(g.id) && g.memberCount < g.maxMembers));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(groupId: string) {
    if (!accessToken) return;
    setJoinError(null);
    setJoining((prev) => new Set(prev).add(groupId));
    try {
      await api.post(`/api/v1/groups/${groupId}/join`, {}, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Could not join that group');
    } finally {
      setJoining((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Groups</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Users size={22} /> Groups
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your networking circles, plus open groups you can join for free.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* My groups */}
          {groups.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">My groups</h2>
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
            </section>
          )}

          {/* Discover / join */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                {groups.length === 0 ? 'Join a group' : 'Discover more groups'}
              </h2>
              <span className="text-xs font-medium text-emerald-600">Free and open to all</span>
            </div>

            {groups.length === 0 && (
              <p className="mb-4 text-sm text-gray-600">
                You haven&rsquo;t joined a group yet. These are open to everyone - join any that fit and start meeting and referring.
              </p>
            )}
            {joinError && (
              <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{joinError}</p>
            )}

            {discover.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center">
                <Users size={28} className="mx-auto mb-3 text-primary" />
                <h3 className="mb-1 text-base font-semibold text-gray-900">No open groups right now</h3>
                <p className="text-sm text-gray-600">Check back soon, or start your own from the marketing site.</p>
                <Link href="/groups" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                  Browse all groups →
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {discover.map((g) => {
                  const isJoining = joining.has(g.id);
                  const isOpen = (g.joinPolicy ?? 'open') === 'open';
                  return (
                    <li
                      key={g.id}
                      className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900">{g.name}</p>
                        {isOpen ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                            <Lock size={9} /> Private
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={11} /> {g.city}, {g.state}
                      </p>
                      {g.description && <p className="mt-2 line-clamp-2 text-xs text-gray-600">{g.description}</p>}
                      {g.meetingSchedule && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <Calendar size={11} /> {g.meetingSchedule}
                        </p>
                      )}
                      <p className="mt-3 text-xs text-gray-500">
                        {g.memberCount}/{g.maxMembers} members
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        {isOpen ? (
                          <>
                            <button
                              onClick={() => void join(g.id)}
                              disabled={isJoining}
                              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                            >
                              {isJoining ? 'Joining…' : 'Join free'}
                            </button>
                            <Link
                              href={`/dashboard/groups?slug=${g.slug}`}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              Preview →
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/dashboard/groups?slug=${g.slug}`}
                            className="rounded-full border border-primary/30 bg-primary-light px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
                          >
                            Request to join →
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function GroupDetailView({
  slug,
  accessToken,
  meId,
  initialManage,
}: {
  slug: string;
  accessToken: string | null;
  meId: string | null;
  initialManage: boolean;
}) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [showManage, setShowManage] = useState(initialManage);

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

  const isMember =
    !!group &&
    ((!!meId && group.members.some((m) => m.user.id === meId)) ||
      (group.viewerRole != null && group.viewerRole !== undefined));
  const isAdmin = group?.viewerRole === 'LEADER' || group?.viewerRole === 'CO_LEADER';
  const locked = !!group?.locked;
  const memberCount = group?.memberCount ?? group?._count.members ?? 0;

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

  async function requestJoin() {
    if (!group || !accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/api/v1/groups/${group.id}/request`,
        { message: requestNote.trim() || undefined },
        { accessToken: accessToken ?? undefined },
      );
      setRequestSent(true);
      await loadGroup();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send request');
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

  // Closed group, viewer is not a member: show the visible shell + a way in.
  if (locked && !isMember) {
    const pending = group.pendingRequest || requestSent;
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <Link href="/dashboard/groups" className="text-sm text-primary">← My groups</Link>
        <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          {group.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.logoUrl} alt={group.name} className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Lock size={26} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-gray-500">
            <MapPin size={13} /> {group.city}, {group.state} · {memberCount} members
          </p>
          {group.description && <p className="mt-3 text-sm text-gray-700">{group.description}</p>}

          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-gray-600">
              <Lock size={14} /> This is a private group
            </p>
            <p className="mt-1 text-xs text-gray-500">
              The member list, events and chat are visible once you are approved to join.
            </p>
          </div>

          {pending ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Your request to join is pending approval. We&rsquo;ll email you as soon as a group
              leader approves it.
            </div>
          ) : (
            <div className="mt-6 text-left">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Request to join
              </label>
              <textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Add a short note for the group leaders (optional)…"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => void requestJoin()}
                disabled={busy}
                className="mt-3 w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Request to join'}
              </button>
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Link href="/dashboard/groups" className="text-sm text-primary">← My groups</Link>

      <header className="mt-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
              <MapPin size={13} /> {group.city}, {group.state} · {memberCount}/{group.maxMembers} members
            </p>
            {group.meetingSchedule && (
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <Calendar size={13} /> {group.meetingSchedule}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowManage((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-light px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Settings size={14} /> {showManage ? 'Close manage' : 'Manage group'}
              </button>
            )}
            {isMember ? (
              <button
                onClick={() => void leave()}
                disabled={busy}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Leave group
              </button>
            ) : group.pendingRequest || requestSent ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                Request pending
              </span>
            ) : group.joinPolicy === 'request' ? (
              <button
                onClick={() => void requestJoin()}
                disabled={busy}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Request to join'}
              </button>
            ) : group.joinPolicy === 'invite' ? (
              <span className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500">
                Invite only
              </span>
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
        </div>
        {group.description && <p className="mt-3 text-sm text-gray-700">{group.description}</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </header>

      {isAdmin && showManage && (
        <GroupManagePanel groupId={group.id} accessToken={accessToken} />
      )}

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

interface InviteLink {
  token: string;
  url: string;
  expiresAt: string;
  grantsPremium: boolean;
  uses: number;
}
interface JoinRequestRow {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    memberProfile: { businessName: string | null; industry: string | null; city: string | null; state: string | null } | null;
  };
}

function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function GroupManagePanel({
  groupId,
  accessToken,
}: {
  groupId: string;
  accessToken: string | null;
}) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [l, r] = await Promise.all([
        api.get<InviteLink | null>(`/api/v1/groups/${groupId}/invite-link`, { accessToken }),
        api.get<JoinRequestRow[]>(`/api/v1/groups/${groupId}/requests`, { accessToken }),
      ]);
      setLink(l);
      setRequests(r);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not load');
    }
  }, [groupId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mint() {
    if (!accessToken) return;
    setBusy(true);
    setErr(null);
    try {
      const l = await api.post<InviteLink>(
        `/api/v1/groups/${groupId}/invite-link`,
        { hours: 48, grantsPremium: true },
        { accessToken },
      );
      setLink(l);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not create link');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!accessToken) return;
    if (!window.confirm('Expire this invite link now? Anyone who has it will no longer be able to join.')) return;
    setBusy(true);
    try {
      await api.delete(`/api/v1/groups/${groupId}/invite-link`, { accessToken });
      setLink(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not revoke');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function decide(id: string, decision: 'approve' | 'decline') {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/groups/requests/${id}/decide`, { decision }, { accessToken });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not update request');
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-primary/20 bg-primary-light/40 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Settings size={15} className="text-primary" /> Group manager
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        Leaders and co-leaders only. Share the launch invite link and approve requests to join.
      </p>
      {err && <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{err}</p>}

      {/* Invite link */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Link2 size={14} className="text-primary" /> Shared invite link
        </p>
        {link ? (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link.url}
                className="flex-1 truncate rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700"
              />
              <button
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {timeLeft(link.expiresAt)}
              </span>
              {link.grantsPremium && (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                  <Crown size={12} /> Grants lifetime Premium
                </span>
              )}
              <span>{link.uses} joined via this link</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void mint()}
                disabled={busy}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
              >
                Regenerate (new 48h link)
              </button>
              <button
                onClick={() => void revoke()}
                disabled={busy}
                className="rounded-full border border-danger/30 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-60"
              >
                Expire now
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-gray-500">
              No active link. Generate one to share with the partner team - it lasts 48 hours and
              anyone who joins through it gets lifetime Premium and is added automatically.
            </p>
            <button
              onClick={() => void mint()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Link2 size={14} /> {busy ? 'Creating…' : 'Generate 48-hour invite link'}
            </button>
          </div>
        )}
      </div>

      {/* Join requests */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Users size={14} className="text-primary" /> Requests to join
          <span className="text-gray-400">({requests.length})</span>
        </p>
        {requests.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">No pending requests.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {r.user.firstName} {r.user.lastName}
                    {r.user.memberProfile?.businessName && (
                      <span className="text-gray-500"> · {r.user.memberProfile.businessName}</span>
                    )}
                  </p>
                  {r.message && <p className="mt-0.5 text-xs text-gray-600">{r.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void decide(r.id, 'approve')}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Check size={13} /> Approve
                  </button>
                  <button
                    onClick={() => void decide(r.id, 'decline')}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    <X size={13} /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
          <p className="mt-8 text-center text-sm text-gray-400">No messages yet - start the conversation.</p>
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
      <form method="post" onSubmit={send} className="flex items-center gap-2 border-t border-gray-100 p-3">
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
