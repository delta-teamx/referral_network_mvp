'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature, Mail, MessageCircle, PenLine } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

interface Invitation {
  id: string;
  recipientEmail: string;
  message: string | null;
  status: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
}

interface Contract {
  id: string;
  title: string;
  body: string;
  status: string;
  senderSignature: string;
  receiverSignature: string | null;
  senderSignedAt: string;
  receiverSignedAt: string | null;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
  receiver: { id: string; firstName: string; lastName: string; email: string };
}

interface MemberOption {
  userId: string;
  businessName: string;
  user: { id: string; firstName: string; lastName: string };
}

const CONTRACT_TEMPLATE = `REFERRAL COLLABORATION AGREEMENT

This agreement is made between the two undersigned members of the Referral Nova platform.

1. PURPOSE — The parties agree to collaborate in good faith on client referrals, introductions, and joint business opportunities arranged through the platform.

2. REFERRALS — Each party agrees to handle referred clients professionally, keep the referring party informed of the outcome, and update the referral status on the platform.

3. CONFIDENTIALITY — Client details shared between the parties remain confidential and may only be used for the referred engagement.

4. COMPENSATION — Any referral fee or revenue share must be agreed in writing between the parties before work begins. (Edit this section with your agreed terms.)

5. TERM — This agreement remains in effect until either party ends it with written notice. Ending it does not affect engagements already in progress.

6. PLATFORM — Both parties acknowledge this agreement was executed on the Referral Nova platform, which retains a copy for both parties' records.

Signed electronically by both parties below.`;

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'signed' || status === 'accepted'
      ? 'bg-success/10 text-success'
      : status === 'declined' || status === 'revoked' || status === 'expired'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-amber-100 text-amber-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>
  );
}

export function InvitationsAndContracts({
  accessToken,
  meId,
}: {
  accessToken: string | null;
  meId: string | null;
}) {
  const [sentInvites, setSentInvites] = useState<Invitation[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invitation[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const router = useRouter();

  /** Share a contract into the chat with the other party and jump there. */
  async function shareInChat(contract: Contract) {
    if (!accessToken || !meId) return;
    const peer = contract.receiver.id === meId ? contract.sender : contract.receiver;
    setSharingId(contract.id);
    setError(null);
    try {
      const convo = await api.post<{ id: string }>(
        '/api/v1/messages/start',
        { targetUserId: peer.id },
        { accessToken: accessToken ?? undefined },
      );
      await api.post(
        `/api/v1/messages/${convo.id}/messages`,
        {
          text: `📄 Contract: "${contract.title}" (${contract.status}). Review and sign it in your Contracts tab: https://dashboard.referralnova.com/dashboard/referrals`,
        },
        { accessToken: accessToken ?? undefined },
      );
      router.push(`/dashboard/messages?c=${convo.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not share the contract in chat');
    } finally {
      setSharingId(null);
    }
  }

  async function loadAll() {
    if (!accessToken) return;
    const opts = { accessToken: accessToken ?? undefined };
    const [snt, rcv, cts, mem] = await Promise.all([
      api.get<Invitation[]>('/api/v1/invitations/sent', opts).catch(() => []),
      api.get<Invitation[]>('/api/v1/invitations/received', opts).catch(() => []),
      api.get<Contract[]>('/api/v1/contracts/mine', opts).catch(() => []),
      api.get<MemberOption[]>('/api/v1/profiles/search', { ...opts, query: { limit: 50 } }).catch(() => []),
    ]);
    setSentInvites(snt);
    setReceivedInvites(rcv);
    setContracts(cts);
    setMembers(mem.filter((m) => m.user.id !== meId));
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function sendInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.post(
        '/api/v1/invitations',
        {
          recipientEmail: String(form.get('email') ?? '').trim(),
          message: String(form.get('message') ?? '').trim() || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setNotice('Invitation sent ✅');
      setInviteOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send invitation');
    } finally {
      setBusy(false);
    }
  }

  async function createContract(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.post(
        '/api/v1/contracts',
        {
          receiverUserId: String(form.get('receiverUserId') ?? ''),
          title: String(form.get('title') ?? '').trim(),
          body: String(form.get('body') ?? '').trim(),
          senderSignature: String(form.get('signature') ?? '').trim(),
        },
        { accessToken: accessToken ?? undefined },
      );
      setNotice('Contract sent for signature ✅ — they and the admins have been notified.');
      setBuilderOpen(false);
      await loadAll();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (status ${err.status})` : ''}`
          : 'Could not create contract',
      );
    } finally {
      setBusy(false);
    }
  }

  async function sign(contractId: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/api/v1/contracts/${contractId}/sign`,
        { signature: String(form.get('signature') ?? '').trim() },
        { accessToken: accessToken ?? undefined },
      );
      setNotice('Contract signed ✅ — both parties and the admins have been emailed.');
      setSigningId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign');
    } finally {
      setBusy(false);
    }
  }

  async function decline(contractId: string) {
    if (!accessToken) return;
    if (!window.confirm('Decline this contract?')) return;
    try {
      await api.post(`/api/v1/contracts/${contractId}/decline`, {}, { accessToken: accessToken ?? undefined });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline');
    }
  }

  return (
    <div className="space-y-10">
      {(error || notice) && (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            error
              ? 'border-danger/30 bg-danger/5 text-danger'
              : 'border-success/30 bg-success/5 text-success'
          }`}
        >
          {error ?? notice}
        </p>
      )}

      {/* ── Contracts ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <FileSignature size={14} /> Contracts ({contracts.length})
          </h2>
          <button
            onClick={() => setBuilderOpen((v) => !v)}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <PenLine size={12} className="mr-1 inline" /> New contract
          </button>
        </div>

        {builderOpen && (
          <form
            onSubmit={createContract}
            className="mb-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-900">
              Send the platform contract for signature
            </p>
            <select
              name="receiverUserId"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Choose the member you&apos;re contracting with…
              </option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.firstName} {m.user.lastName} — {m.businessName}
                </option>
              ))}
            </select>
            <input
              name="title"
              required
              defaultValue="Referral Collaboration Agreement"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              name="body"
              rows={10}
              required
              defaultValue={CONTRACT_TEMPLATE}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs leading-relaxed"
            />
            <input
              name="signature"
              required
              placeholder="Type your full legal name to sign"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm italic"
            />
            <p className="text-xs text-gray-500">
              The other member and the platform admins are notified; the contract becomes
              binding when they countersign.
            </p>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Sign & send contract'}
            </button>
          </form>
        )}

        {contracts.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No contracts yet. When a collaboration gets serious, send the platform contract —
            both signatures live here and admins keep a copy.
          </p>
        ) : (
          <ul className="space-y-3">
            {contracts.map((c) => {
              const iAmReceiver = c.receiver.id === meId;
              const peer = iAmReceiver ? c.sender : c.receiver;
              return (
                <li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{c.title}</p>
                        <StatusPill status={c.status} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        with {peer.firstName} {peer.lastName} ·{' '}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        ✍️ {c.sender.firstName}: <span className="italic">{c.senderSignature}</span>
                        {c.receiverSignature && (
                          <>
                            {' '}· ✍️ {c.receiver.firstName}:{' '}
                            <span className="italic">{c.receiverSignature}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary"
                      >
                        {expandedId === c.id ? 'Hide terms' : 'View terms'}
                      </button>
                      <button
                        onClick={() => void shareInChat(c)}
                        disabled={sharingId === c.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-primary hover:text-primary disabled:opacity-60"
                      >
                        <MessageCircle size={11} />
                        {sharingId === c.id ? 'Sharing…' : 'Share in chat'}
                      </button>
                      {iAmReceiver && c.status === 'sent' && (
                        <>
                          <button
                            onClick={() => setSigningId(signingId === c.id ? null : c.id)}
                            className="rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                          >
                            Sign contract
                          </button>
                          <button
                            onClick={() => void decline(c.id)}
                            className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {!iAmReceiver && c.status === 'sent' && (
                        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                          Awaiting their signature
                        </span>
                      )}
                    </div>
                  </div>
                  {expandedId === c.id && (
                    <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-4 font-mono text-xs leading-relaxed text-gray-700">
                      {c.body}
                    </pre>
                  )}
                  {signingId === c.id && (
                    <form onSubmit={(e) => void sign(c.id, e)} className="mt-3 flex flex-wrap gap-2">
                      <input
                        name="signature"
                        required
                        placeholder="Type your full legal name to sign"
                        className="min-w-64 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm italic"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-full bg-success px-5 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-60"
                      >
                        {busy ? 'Signing…' : 'Sign'}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Invitations ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <Mail size={14} /> Invitations
          </h2>
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:border-primary"
          >
            Invite someone to the network
          </button>
        </div>

        {inviteOpen && (
          <form
            onSubmit={sendInvite}
            className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="their@email.com"
              className="min-w-56 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="message"
              placeholder="Personal note (optional)"
              className="min-w-56 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              Send invite
            </button>
          </form>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">
              Received ({receivedInvites.length})
            </p>
            {receivedInvites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-xs text-gray-500">
                No invitations received.
              </p>
            ) : (
              <ul className="space-y-2">
                {receivedInvites.map((i) => (
                  <li key={i.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {i.sender.firstName} {i.sender.lastName}
                      </span>
                      <StatusPill status={i.status} />
                    </div>
                    {i.message && <p className="mt-1 text-xs text-gray-600">{i.message}</p>}
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(i.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">Sent ({sentInvites.length})</p>
            {sentInvites.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-xs text-gray-500">
                No invitations sent. Invite peers you already refer business to.
              </p>
            ) : (
              <ul className="space-y-2">
                {sentInvites.map((i) => (
                  <li key={i.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{i.recipientEmail}</span>
                      <StatusPill status={i.status} />
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(i.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
