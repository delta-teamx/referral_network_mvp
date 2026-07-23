'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Check,
  FileSignature,
  Inbox,
  Mail,
  MessageCircle,
  Send,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

/**
 * My network = the relationships that produced results: deals you WON and
 * partners with a SIGNED contract sit on top — these are the contacts to
 * nurture. Connections and invites live below.
 */

type Status = 'pending' | 'accepted' | 'declined' | 'archived';
type Direction = 'inbound' | 'outbound';

interface Connection {
  id: string;
  status: Status;
  direction: Direction;
  strengthScore: string;
  createdAt: string;
  acceptedAt: string | null;
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
}

interface PipelineCard {
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

interface Contract {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
  receiver: { id: string; firstName: string; lastName: string; email: string };
}

export default function NetworkPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [wonCards, setWonCards] = useState<PipelineCard[]>([]);
  const [signedContracts, setSignedContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [conns, invs, cards, contracts] = await Promise.all([
        api.get<Connection[]>('/api/v1/connections', { accessToken }),
        api
          .get<Invitation[]>('/api/v1/invitations/sent', { accessToken })
          .catch(() => [] as Invitation[]),
        api.get<PipelineCard[]>('/api/v1/pipeline', { accessToken }).catch(() => [] as PipelineCard[]),
        api.get<Contract[]>('/api/v1/contracts/mine', { accessToken }).catch(() => [] as Contract[]),
      ]);
      setConnections(conns);
      setInvitations(invs);
      setWonCards(cards.filter((c) => c.stage === 'won' || c.stage === 'contract_signed'));
      setSignedContracts(contracts.filter((c) => c.status === 'signed'));
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

  const accepted = connections.filter((c) => c.status === 'accepted');
  const pendingInbound = connections.filter(
    (c) => c.status === 'pending' && c.direction === 'inbound',
  );
  const pendingOutbound = connections.filter(
    (c) => c.status === 'pending' && c.direction === 'outbound',
  );
  const pendingInvites = invitations.filter((i) => i.status === 'pending');

  return (
    <UpgradeGate feature="My Network" requiredTier="PRO">
    <div className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Network</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">My network</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            The relationships that win you business. Deals you won and signed contract partners
            live on top — keep working those first.
          </p>
        </div>
        <Link
          href="/dashboard/network/invite"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <UserPlus size={14} /> Invite a business
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Won deals & signed partners ─────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              <Trophy size={14} className="text-emerald-500" /> Won deals &amp; signed partners (
              {wonCards.length})
            </h2>
            {wonCards.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                <Trophy size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-600">
                  No won deals yet. Move a card to <strong>Won</strong> (or get a contract
                  signed) on your{' '}
                  <Link href="/dashboard/leads" className="font-semibold text-primary hover:underline">
                    Pipeline
                  </Link>{' '}
                  and the contact lands here.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {wonCards.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-gray-900">{c.name}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            c.stage === 'won'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-teal-100 text-teal-700'
                          }`}
                        >
                          {c.stage === 'won' ? 'Won 🏆' : 'Contract signed'}
                        </span>
                      </div>
                      {c.contact?.memberProfile && (
                        <p className="truncate text-xs text-gray-500">
                          {c.contact.memberProfile.businessName} ·{' '}
                          {c.contact.memberProfile.industry}
                        </p>
                      )}
                      {c.email && !c.contact && (
                        <p className="truncate text-xs text-gray-500">{c.email}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        since {new Date(c.stageUpdatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {c.contactUserId && (
                      <Link
                        href={`/dashboard/members/profile?id=${c.contactUserId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-white"
                      >
                        <MessageCircle size={12} /> Open profile
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Signed contracts record ─────────────────────────────── */}
          {signedContracts.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <FileSignature size={14} /> Signed contracts ({signedContracts.length})
              </h2>
              <ul className="space-y-2">
                {signedContracts.map((c) => {
                  const peer = c.receiver.id === me?.id ? c.sender : c.receiver;
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-500">
                          with {peer.firstName} {peer.lastName} ·{' '}
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Link
                        href="/dashboard/referrals"
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        View in Contracts →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ── Incoming connection requests ────────────────────────── */}
          {pendingInbound.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <Inbox size={14} /> Incoming requests ({pendingInbound.length})
              </h2>
              <ul className="space-y-3">
                {pendingInbound.map((c) => (
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
                        onClick={() => void respond(c.id, 'accept')}
                        className="inline-flex items-center gap-1 rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                      >
                        <Check size={13} /> Accept
                      </button>
                      <button
                        onClick={() => void respond(c.id, 'decline')}
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

          {/* ── Connections ─────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
              <Check size={14} /> Connections ({accepted.length})
            </h2>
            {accepted.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-600">
                  No connections yet. Accept intro requests or invite peers you already refer
                  business to.
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {accepted.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {c.peer.firstName} {c.peer.lastName}
                      </p>
                      <p className="truncate text-xs text-gray-500">{c.peer.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Strength {Number(c.strengthScore).toFixed(1)}
                      </span>
                      <Link
                        href={`/dashboard/members/profile?id=${c.peer.id}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Profile →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Outgoing ────────────────────────────────────────────── */}
          {(pendingOutbound.length > 0 || pendingInvites.length > 0) && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <Send size={14} /> Waiting on them
              </h2>
              <ul className="space-y-2">
                {pendingOutbound.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
                  >
                    <span className="font-medium text-gray-900">
                      {c.peer.firstName} {c.peer.lastName}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      connection pending
                    </span>
                  </li>
                ))}
                {pendingInvites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                      <Mail size={13} className="text-primary" /> {inv.recipientEmail}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      invite sent
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
    </UpgradeGate>
  );
}
