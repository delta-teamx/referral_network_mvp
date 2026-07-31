'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Eye, MessageSquare, Search, Send, Trash2, X } from 'lucide-react';
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

export default function AdminUsersPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<(AdminUser & { profile?: UserProfile }) | null>(null);
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
        query: { q: q || undefined, limit: 50 },
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

  useEffect(() => {
    void load();
  }, [accessToken, q]);

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
    try {
      const profile = await api.get<UserProfile>(`/api/v1/profiles/public/${user.id}`, {
        accessToken: accessToken ?? undefined,
      }).catch(() => undefined);
      setViewingUser({ ...user, profile });
    } catch {
      setViewingUser({ ...user });
    }
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
                  Delivered to their inbox as a ROUL note with an admin badge. For reminders and direct
                  support - it is never added to their pipeline.
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
                Sent. {messagingUser.firstName} will see it at the top of their notification inbox.
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
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-gray-900 p-6 shadow-2xl">
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
                    <p className="font-medium text-white">
                      {u.firstName} {u.lastName}
                      {isSelf && <span className="ml-2 text-xs text-amber-400">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
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
                          onClick={() => void viewUser(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
                        >
                          <Eye size={12} /> View
                        </button>
                      )}
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
    </div>
  );
}
