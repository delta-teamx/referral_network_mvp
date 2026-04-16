'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Inbox, Mail, Send, UserPlus, X } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

type Status = 'pending' | 'accepted' | 'declined' | 'archived';
type Direction = 'inbound' | 'outbound';

interface Connection {
  id: string;
  status: Status;
  direction: Direction;
  strengthScore: string;
  createdAt: string;
  acceptedAt: string | null;
  lastInteractAt: string | null;
  peer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface Invitation {
  id: string;
  recipientEmail: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  token: string;
}

export default function NetworkPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<'accepted' | 'pending' | 'sent_invites'>('accepted');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [conns, invs] = await Promise.all([
        api.get<Connection[]>('/api/v1/connections', { accessToken }),
        api
          .get<Invitation[]>('/api/v1/invitations/sent', { accessToken })
          .catch(() => [] as Invitation[]),
      ]);
      setConnections(conns);
      setInvitations(invs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function respond(id: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/connections/${id}/respond`, { action }, { accessToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  async function revoke(id: string) {
    if (!accessToken) return;
    try {
      await api.delete(`/api/v1/invitations/${id}`, { accessToken });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Revoke failed');
    }
  }

  const accepted = connections.filter((c) => c.status === 'accepted');
  const pendingInbound = connections.filter(
    (c) => c.status === 'pending' && c.direction === 'inbound',
  );
  const pendingOutbound = connections.filter(
    (c) => c.status === 'pending' && c.direction === 'outbound',
  );
  const pendingInvites = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Network</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">My network</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Peer businesses you&rsquo;re connected with. Stronger networks convert more referrals and
            earn higher trust scores.
          </p>
        </div>
        <Link
          href="/dashboard/network/invite"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <UserPlus size={14} /> Invite a business
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <TabButton
          active={tab === 'accepted'}
          icon={Check}
          label={`Connections (${accepted.length})`}
          onClick={() => setTab('accepted')}
        />
        <TabButton
          active={tab === 'pending'}
          icon={Inbox}
          label={`Pending (${pendingInbound.length + pendingOutbound.length})`}
          onClick={() => setTab('pending')}
        />
        <TabButton
          active={tab === 'sent_invites'}
          icon={Send}
          label={`Invites sent (${pendingInvites.length})`}
          onClick={() => setTab('sent_invites')}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonList />
      ) : tab === 'accepted' ? (
        <AcceptedList items={accepted} />
      ) : tab === 'pending' ? (
        <PendingList
          inbound={pendingInbound}
          outbound={pendingOutbound}
          onRespond={(id, action) => void respond(id, action)}
        />
      ) : (
        <SentInvitesList items={pendingInvites} onRevoke={(id) => void revoke(id)} />
      )}
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Check;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition ${
        active
          ? 'bg-primary text-white'
          : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

function AcceptedList({ items }: { items: Connection[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No connections yet"
        body="Grow your network by inviting peers or accepting incoming connection requests."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((c) => (
        <motion.li
          key={c.id}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div>
            <p className="font-semibold text-gray-900">
              {c.peer.firstName} {c.peer.lastName}
            </p>
            <p className="text-xs text-gray-500">{c.peer.email}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
              Strength {Number(c.strengthScore).toFixed(1)}
            </span>
            <span className="text-gray-500">
              since {c.acceptedAt ? new Date(c.acceptedAt).toLocaleDateString() : '—'}
            </span>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

function PendingList({
  inbound,
  outbound,
  onRespond,
}: {
  inbound: Connection[];
  outbound: Connection[];
  onRespond: (id: string, action: 'accept' | 'decline') => void;
}) {
  if (inbound.length + outbound.length === 0) {
    return <EmptyState title="No pending requests" body="All caught up." />;
  }
  return (
    <div className="space-y-6">
      {inbound.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Incoming ({inbound.length})
          </h2>
          <ul className="space-y-3">
            {inbound.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-5"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {c.peer.firstName} {c.peer.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.peer.email} · asked {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRespond(c.id, 'accept')}
                    className="inline-flex items-center gap-1 rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                  >
                    <Check size={13} /> Accept
                  </button>
                  <button
                    onClick={() => onRespond(c.id, 'decline')}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <X size={13} /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outbound.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Outgoing ({outbound.length})
          </h2>
          <ul className="space-y-3">
            {outbound.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {c.peer.firstName} {c.peer.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Sent {new Date(c.createdAt).toLocaleDateString()} · waiting for response
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SentInvitesList({
  items,
  onRevoke,
}: {
  items: Invitation[];
  onRevoke: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No pending invitations"
        body="Invite another business to join the network and get an auto-connection when they sign up."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((inv) => (
        <li
          key={inv.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Mail size={18} className="mt-0.5 text-primary" />
            <div>
              <p className="font-semibold text-gray-900">{inv.recipientEmail}</p>
              <p className="text-xs text-gray-500">
                Sent {new Date(inv.createdAt).toLocaleDateString()} · expires{' '}
                {new Date(inv.expiresAt).toLocaleDateString()}
              </p>
              {inv.message && (
                <p className="mt-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  “{inv.message}”
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onRevoke(inv.id)}
            className="text-xs font-semibold text-gray-500 hover:text-danger"
          >
            Revoke
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}
