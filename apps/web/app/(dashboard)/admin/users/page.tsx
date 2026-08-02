'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, ChevronLeft, ChevronRight, MessageSquare, Search, Send, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  subscriptionTier: string;
  emailVerified: boolean;
  createdAt: string;
  _count: { listings: number; sentReferrals: number };
}

interface UserProfile {
  businessName?: string;
  industry?: string;
  headline?: string;
  city?: string;
  state?: string;
  servicesOffered?: string[];
  keywords?: string[];
}

interface UserActivity {
  lastLoginAt: string | null;
  profileComplete: number;
  messagesSent: number;
  conversations: number;
  replyRate: number;
  connections: number;
  introsSent: number;
  introsAccepted: number;
  referralsSent: number;
  referralsReceived: number;
  invitesOnboarded: number;
  bookings: number;
  bookingsHosted: number;
  bookingsAsGuest: number;
  bookingsConfirmed: number;
  eventsRsvped: number;
  pipeline: Record<string, number>;
  pipelineTotal: number;
  contributionPoints: number;
  recentMessages: { text: string; at: string }[];
}

const PAGE_SIZE = 20;
// Human labels for pipeline stages, shown in the per-user analytics.
const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  in_process: 'In process',
  zoom_booked: 'Zoom booked',
  follow_up: 'Follow up',
  signing_contract: 'Signing',
  contract_signed: 'Signed',
  won: 'Won',
  lost: 'Lost',
  dead: 'Dead',
};

export default function AdminUsersPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<(AdminUser & { profile?: UserProfile }) | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  // Direct ROUL message composer.
  const [messagingUser, setMessagingUser] = useState<AdminUser | null>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  function openMessage(u: AdminUser) {
    setMessagingUser(u);
    setMsgTitle('');
    setMsgText('');
    setMsgSent(false);
    setMsgError(null);
  }

  async function sendMessage() {
    if (!accessToken || !messagingUser || !msgText.trim()) return;
    setMsgSending(true);
    setMsgError(null);
    try {
      await api.post(
        `/api/v1/admin/users/${messagingUser.id}/message`,
        { text: msgText.trim(), title: msgTitle.trim() || undefined },
        { accessToken: accessToken ?? undefined },
      );
      setMsgSent(true);
      setMsgText('');
      setMsgTitle('');
    } catch (err) {
      setMsgError(err instanceof ApiError ? err.message : 'Could not send the message');
    } finally {
      setMsgSending(false);
    }
  }

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<{ users: AdminUser[]; total: number }>('/api/v1/admin/users', {
        query: { q: q || undefined, page, limit: PAGE_SIZE },
        accessToken: accessToken ?? undefined,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  // Reset to page 1 whenever the search changes.
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function setRole(id: string, role: string) {
    if (!accessToken) return;
    if (id === currentUser?.id) {
      setError('You cannot change your own role.');
      return;
    }
    const label = role === 'ADMIN' ? 'Grant ADMIN access to this user?' : `Change this user's role to ${role}?`;
    if (!window.confirm(label)) return;
    try {
      await api.post(`/api/v1/admin/users/${id}/role`, { role }, { accessToken: accessToken ?? undefined });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  /** Comp or change a member's plan (founding-200 grants, refunds, etc.). */
  async function setTier(u: AdminUser, tier: string) {
    if (!accessToken || tier === u.subscriptionTier) return;
    if (!window.confirm(`Change ${u.email}'s plan to ${tier}?`)) return;
    try {
      await api.post(`/api/v1/admin/users/${u.id}/tier`, { tier }, { accessToken: accessToken ?? undefined });
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Plan change failed');
    }
  }

  async function suspend(id: string) {
    if (!accessToken) return;
    const reason = window.prompt('Suspension reason? (required)');
    if (!reason || reason.length < 3) return;
    try {
      await api.post(
        `/api/v1/admin/users/${id}/suspend`,
        { reason },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suspend failed');
    }
  }

  /** Irreversible: wipes the account and ALL its data (test-data cleanup). */
  async function hardDelete(u: AdminUser) {
    if (!accessToken) return;
    if (u.role === 'ADMIN') {
      setError('Admin accounts cannot be hard-deleted.');
      return;
    }
    if (
      !window.confirm(
        `PERMANENTLY delete ${u.firstName} ${u.lastName} (${u.email})?\n\nThis wipes their profile, conversations (both sides), bookings, contracts, referrals, pipeline cards, listings and support tickets. This cannot be undone.`,
      )
    )
      return;
    const typed = window.prompt(`Type DELETE to confirm wiping ${u.email}:`);
    if (typed !== 'DELETE') return;
    try {
      await api.delete(`/api/v1/admin/users/${u.id}`, { accessToken: accessToken ?? undefined });
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  async function viewUser(user: AdminUser) {
    setActivity(null);
    try {
      const profile = await api.get<UserProfile>(`/api/v1/profiles/public/${user.id}`, {
        accessToken: accessToken ?? undefined,
      }).catch(() => undefined);
      setViewingUser({ ...user, profile });
    } catch {
      setViewingUser({ ...user });
    }
    // Activity snapshot (separate call so a profile miss doesn't block it).
    void api
      .get<UserActivity>(`/api/v1/admin/users/${user.id}/activity`, {
        accessToken: accessToken ?? undefined,
      })
      .then((a) => setActivity(a))
      .catch(() => undefined);
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Users</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            All accounts{' '}
            <span className="text-sm font-normal text-gray-400">({total.toLocaleString()})</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
          <Search size={14} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email or name…"
            className="w-64 bg-transparent text-sm text-gray-100 outline-none"
          />
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Direct ROUL message composer */}
      {messagingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <MessageSquare size={18} className="text-blue-400" /> Message {messagingUser.firstName}
                </h2>
                <p className="text-xs text-gray-400">
                  Lands in their Messages tab as a two-way ROUL Support thread and emails them too.
                  They reply there; you answer under Member messages. Never added to their pipeline.
                </p>
              </div>
              <button
                onClick={() => setMessagingUser(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            {msgSent ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
                Sent. It is now in {messagingUser.firstName}&rsquo;s Messages tab (and emailed to them).
                Watch for their reply under Member messages.
                <button
                  onClick={() => setMsgSent(false)}
                  className="ml-2 font-semibold text-emerald-200 underline"
                >
                  Send another
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                  placeholder="Subject (optional) - defaults to a note from ROUL"
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
                />
                <textarea
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={`Write your message to ${messagingUser.firstName}…`}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
                />
                {msgError && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {msgError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setMessagingUser(null)}
                    className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void sendMessage()}
                    disabled={msgSending || !msgText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Send size={14} /> {msgSending ? 'Sending…' : 'Send to inbox'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View User Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{viewingUser.firstName} {viewingUser.lastName}</h2>
                <p className="text-sm text-gray-400">{viewingUser.email}</p>
              </div>
              <button onClick={() => setViewingUser(null)} className="rounded p-1 text-gray-400 hover:bg-gray-800">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Role</span>
                <span className="text-gray-200">{viewingUser.role}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Tier</span>
                <span className="text-gray-200">{viewingUser.subscriptionTier}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Email verified</span>
                <span className="text-gray-200">{viewingUser.emailVerified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Listings</span>
                <span className="text-gray-200">{viewingUser._count.listings}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Referrals sent</span>
                <span className="text-gray-200">{viewingUser._count.sentReferrals}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-500">Joined</span>
                <span className="text-gray-200">{new Date(viewingUser.createdAt).toLocaleDateString()}</span>
              </div>

              {/* In-depth activity & analytics */}
              <h3 className="mt-4 font-semibold text-amber-400">Analytics</h3>
              {!activity ? (
                <p className="text-xs text-gray-500">Loading analytics…</p>
              ) : (
                <>
                  <p className="mb-1 mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Engagement</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ['Messages sent', activity.messagesSent],
                      ['Conversations', activity.conversations],
                      ['Reply rate', `${activity.replyRate}%`],
                      ['Connections', activity.connections],
                      ['Intros sent', activity.introsSent],
                      ['Intros accepted', activity.introsAccepted],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="text-sm font-semibold text-gray-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Zoom & meetings</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['Calls total', activity.bookings],
                      ['Confirmed', activity.bookingsConfirmed],
                      ['As host', activity.bookingsHosted],
                      ['Events RSVP', activity.eventsRsvped],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="text-sm font-semibold text-gray-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Pipeline ({activity.pipelineTotal} cards)
                  </p>
                  {activity.pipelineTotal === 0 ? (
                    <p className="text-xs text-gray-600">No pipeline cards yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(activity.pipeline).map(([stage, count]) => (
                        <span
                          key={stage}
                          className="rounded-full border border-gray-800 bg-gray-950/60 px-2.5 py-1 text-xs text-gray-300"
                        >
                          {STAGE_LABELS[stage] ?? stage}: <span className="font-semibold text-gray-100">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Growth & account</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {[
                      ['Referrals sent / recv', `${activity.referralsSent} / ${activity.referralsReceived}`],
                      ['Invites onboarded', activity.invitesOnboarded],
                      ['Contribution points', activity.contributionPoints],
                      ['Profile complete', `${activity.profileComplete}%`],
                      ['Last login', activity.lastLoginAt ? new Date(activity.lastLoginAt).toLocaleDateString() : 'Never'],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="text-sm font-semibold text-gray-100">{value}</p>
                      </div>
                    ))}
                  </div>

                  {activity.recentMessages.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-xs text-gray-500">Recent messages sent</p>
                      <ul className="space-y-1">
                        {activity.recentMessages.map((m, i) => (
                          <li key={i} className="truncate rounded bg-gray-950/60 px-2 py-1 text-xs text-gray-300">
                            <span className="text-gray-500">{new Date(m.at).toLocaleDateString()}:</span> {m.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {viewingUser.profile && (
                <>
                  <h3 className="mt-4 font-semibold text-amber-400">Business Profile</h3>
                  {viewingUser.profile.businessName && (
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500">Business</span>
                      <span className="text-gray-200">{viewingUser.profile.businessName}</span>
                    </div>
                  )}
                  {viewingUser.profile.industry && (
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500">Industry</span>
                      <span className="text-gray-200">{viewingUser.profile.industry}</span>
                    </div>
                  )}
                  {viewingUser.profile.headline && (
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500">Headline</span>
                      <span className="text-gray-200">{viewingUser.profile.headline}</span>
                    </div>
                  )}
                  {viewingUser.profile.city && (
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-500">Location</span>
                      <span className="text-gray-200">{viewingUser.profile.city}, {viewingUser.profile.state}</span>
                    </div>
                  )}
                  {viewingUser.profile.servicesOffered && viewingUser.profile.servicesOffered.length > 0 && (
                    <div className="border-b border-gray-800 pb-2">
                      <span className="text-gray-500">Services</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {viewingUser.profile.servicesOffered.map((s) => (
                          <span key={s} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <button
              onClick={() => setViewingUser(null)}
              className="mt-6 w-full rounded-full bg-gray-800 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800/50 text-left text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Listings</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No users match.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void viewUser(u)}
                      title="Click to see this member's full activity & analytics"
                      className="group text-left"
                    >
                      <p className="font-medium text-white group-hover:text-amber-300 group-hover:underline">
                        {u.firstName} {u.lastName}
                        {isSelf && <span className="ml-2 text-xs text-amber-400">(you)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => void setRole(u.id, e.target.value)}
                      className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {['CONSUMER', 'BUSINESS_OWNER', 'GROUP_LEADER', 'CITY_CAPTAIN', 'ADMIN'].map(
                        (r) => (
                          <option key={r}>{r}</option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.subscriptionTier}
                      onChange={(e) => void setTier(u, e.target.value)}
                      title="Change this member's plan"
                      className={`rounded-md border border-gray-700 px-2 py-1 text-xs font-semibold ${
                        u.subscriptionTier === 'PREMIUM'
                          ? 'bg-amber-500/20 text-amber-300'
                          : u.subscriptionTier === 'PRO'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-gray-800 text-gray-300'
                      }`}
                    >
                      {['FREE', 'PRO', 'PREMIUM'].map((t) => (
                        <option key={t} value={t} className="bg-gray-800 text-gray-100">
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{u._count.listings}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isSelf && (
                        <button
                          onClick={() => openMessage(u)}
                          title="Send a direct ROUL message to this member's inbox"
                          className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-xs text-blue-300 hover:bg-blue-500/10"
                        >
                          <MessageSquare size={12} /> Message
                        </button>
                      )}
                      {!isSelf && (
                        <button
                          onClick={() => void suspend(u.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                        >
                          <Ban size={12} /> Suspend
                        </button>
                      )}
                      {!isSelf && u.role !== 'ADMIN' && (
                        <button
                          onClick={() => void hardDelete(u)}
                          title="Permanently delete this user and all their data"
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - 20 per page, page through all accounts */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of{' '}
            {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<number[]>((acc, n) => {
                if (acc.length && n - acc[acc.length - 1]! > 1) acc.push(-1); // gap marker
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === -1 ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-gray-600">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`min-w-[28px] rounded-md px-2 py-1.5 text-xs font-semibold ${
                      n === page
                        ? 'bg-amber-500 text-gray-950'
                        : 'border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-40"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
