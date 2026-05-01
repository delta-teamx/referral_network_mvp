'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Calendar, Check, UserCheck, Video, XCircle } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { UpgradeGate } from '../../../../components/billing/UpgradeGate';

type Status = 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'DECLINED';

interface Referral {
  id: string;
  status: Status;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string | null;
  convertedAt: string | null;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; email: string };
  receiver: { id: string; firstName: string; lastName: string; email: string };
  listing: { id: string; slug: string; name: string; city: string; state: string };
}

export default function ReferralsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState<Referral[]>([]);
  const [sent, setSent] = useState<Referral[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [rec, snt] = await Promise.all([
        api.get<Referral[]>('/api/v1/referrals/received', {
          accessToken: accessToken ?? undefined,
        }),
        api.get<Referral[]>('/api/v1/referrals/sent', { accessToken: accessToken ?? undefined }),
      ]);
      setReceived(rec);
      setSent(snt);
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

  async function updateStatus(id: string, status: Status) {
    if (!accessToken) return;
    try {
      await api.patch(
        `/api/v1/referrals/${id}/status`,
        { status },
        { accessToken: accessToken ?? undefined },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  }

  const list = tab === 'received' ? received : sent;

  return (
    <UpgradeGate feature="Referral Management" requiredTier="PRO">
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Network</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Clients that other network members referred to you, and clients you referred to them.
          Conversion counts toward everyone&rsquo;s trust score.
        </p>
      </header>

      <div className="mb-5 flex gap-2">
        <TabButton
          active={tab === 'received'}
          icon={ArrowDownLeft}
          label={`Received (${received.length})`}
          onClick={() => setTab('received')}
        />
        <TabButton
          active={tab === 'sent'}
          icon={ArrowUpRight}
          label={`Sent (${sent.length})`}
          onClick={() => setTab('sent')}
        />
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">
            {tab === 'received'
              ? 'No referrals received yet. Once network peers refer clients to you, they land here.'
              : "You haven't sent any referrals yet. Find a trusted pro and click \u201CRefer this business\u201D on their page."}
          </p>
          {tab === 'sent' && (
            <Link
              href="/search"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Find businesses to refer →
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <motion.li
              key={r.id}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {r.clientName ?? 'Unnamed client'}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {tab === 'received'
                      ? `from ${r.sender.firstName} ${r.sender.lastName}`
                      : `to ${r.receiver.firstName} ${r.receiver.lastName}`}{' '}
                    · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    on{' '}
                    <Link
                      href={`/listing/${r.listing.slug}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.listing.name}
                    </Link>
                  </p>
                </div>
                {(r.clientEmail || r.clientPhone) && (
                  <div className="flex flex-col gap-1 text-sm md:items-end">
                    {r.clientEmail && (
                      <a
                        href={`mailto:${r.clientEmail}`}
                        className="text-gray-700 hover:text-primary"
                      >
                        {r.clientEmail}
                      </a>
                    )}
                    {r.clientPhone && (
                      <a href={`tel:${r.clientPhone}`} className="text-gray-700 hover:text-primary">
                        {r.clientPhone}
                      </a>
                    )}
                  </div>
                )}
              </div>
              {r.notes && (
                <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {r.notes}
                </p>
              )}
              {tab === 'received' && r.status !== 'CONVERTED' && r.status !== 'DECLINED' && (
                <div className="flex flex-wrap gap-2">
                  {r.status === 'SENT' && (
                    <button
                      onClick={() => void updateStatus(r.id, 'ACCEPTED')}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Check size={13} /> Accept
                    </button>
                  )}
                  <button
                    onClick={() => void updateStatus(r.id, 'CONVERTED')}
                    className="inline-flex items-center gap-1 rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                  >
                    <UserCheck size={13} /> Mark converted
                  </button>
                  <button
                    onClick={() => void updateStatus(r.id, 'DECLINED')}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <XCircle size={13} /> Decline
                  </button>
                </div>
              )}
              {/* After-accept CTAs: book a call with the peer or join next event */}
              {r.status === 'ACCEPTED' && (
                <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <p className="flex-1 text-xs font-medium text-blue-900">
                    Next step: meet live to close this referral faster.
                  </p>
                  <Link
                    href={`/search?q=${encodeURIComponent(tab === 'received' ? `${r.sender.firstName} ${r.sender.lastName}` : `${r.receiver.firstName} ${r.receiver.lastName}`)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                  >
                    <Calendar size={12} /> Book a call
                  </Link>
                  <Link
                    href="/events"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary"
                  >
                    <Video size={12} /> Join networking event
                  </Link>
                </div>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
    </UpgradeGate>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof ArrowDownLeft;
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
      <Icon size={14} />
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    SENT: 'bg-amber-100 text-amber-800',
    ACCEPTED: 'bg-blue-100 text-blue-700',
    CONVERTED: 'bg-success/10 text-success',
    DECLINED: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
