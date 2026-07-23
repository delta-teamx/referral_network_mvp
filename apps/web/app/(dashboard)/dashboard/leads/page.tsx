'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, Phone, UserCheck, XCircle } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

type LeadStatus = 'PENDING' | 'CONTACTED' | 'CONVERTED' | 'EXPIRED';

interface Lead {
  id: string;
  status: LeadStatus;
  eventType: string;
  notes: string | null;
  contactedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  consumer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  listing: { slug: string; name: string };
}

const FILTERS: Array<{ key: 'all' | LeadStatus; label: string; tone: string }> = [
  { key: 'all', label: 'All', tone: 'bg-gray-100 text-gray-700' },
  { key: 'PENDING', label: 'New', tone: 'bg-amber-100 text-amber-800' },
  { key: 'CONTACTED', label: 'Contacted', tone: 'bg-blue-100 text-blue-700' },
  { key: 'CONVERTED', label: 'Won', tone: 'bg-success/10 text-success' },
  { key: 'EXPIRED', label: 'Expired', tone: 'bg-gray-100 text-gray-500' },
];

interface MessageLead {
  id: string;
  updatedAt: string;
  otherUser: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
  lastMessage: { id: string; senderId: string; text: string; createdAt: string } | null;
  unread: boolean;
}

interface IntroLead {
  id: string;
  status: string;
  reason: string;
  sender: { id: string; firstName: string; lastName: string };
  target: { id: string; firstName: string; lastName: string };
}

export default function LeadsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messageLeads, setMessageLeads] = useState<MessageLead[]>([]);
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');
  const [loading, setLoading] = useState(true);

  const [introLeads, setIntroLeads] = useState<IntroLead[]>([]);

  // Every received message and intro request is a lead: surface them here too.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const [convos, intros] = await Promise.all([
          api.get<MessageLead[]>('/api/v1/messages', { accessToken: accessToken ?? undefined }),
          api.get<IntroLead[]>('/api/v1/ai/suggestions', { accessToken: accessToken ?? undefined }),
        ]);
        if (!cancelled) {
          setMessageLeads(convos.filter((c) => c.lastMessage));
          setIntroLeads(
            intros.filter((i) => i.status === 'requested' && i.target.id === user?.id),
          );
        }
      } catch {
        /* best-effort — consumer leads below still load */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, user?.id]);

  async function respondIntro(id: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    try {
      await api.post(`/api/v1/ai/introductions/${id}/respond`, { action }, {
        accessToken: accessToken ?? undefined,
      });
      setIntroLeads((prev) => prev.filter((i) => i.id !== id));
    } catch {
      /* surfaced elsewhere */
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<Lead[]>('/api/v1/consumer-leads/received', {
          accessToken: accessToken ?? undefined,
          query: filter === 'all' ? undefined : { status: filter },
        });
        if (!cancelled) setLeads(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, filter]);

  async function setStatus(id: string, status: LeadStatus) {
    if (!accessToken) return;
    await api.patch(
      `/api/v1/consumer-leads/${id}/status`,
      { status },
      { accessToken: accessToken ?? undefined },
    );
    // optimistic - refetch list after
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status,
              contactedAt: status === 'CONTACTED' ? new Date().toISOString() : l.contactedAt,
              convertedAt: status === 'CONVERTED' ? new Date().toISOString() : l.convertedAt,
            }
          : l,
      ),
    );
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Inbox</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Your leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Member messages and consumer requests, in one inbox. Respond within 24 hours to keep
          your trust score healthy.
        </p>
      </header>

      {/* ── Intro requests: someone wants to be introduced to you ───────── */}
      {introLeads.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <UserCheck size={14} /> Intro requests ({introLeads.length})
          </h2>
          <ul className="space-y-3">
            {introLeads.map((i) => (
              <motion.li
                key={i.id}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-light/30 p-5 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {i.sender.firstName} {i.sender.lastName} wants an intro
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{i.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void respondIntro(i.id, 'accept')}
                    className="rounded-full bg-success px-4 py-2 text-xs font-semibold text-white hover:bg-success/90"
                  >
                    Accept — start conversation
                  </button>
                  <button
                    onClick={() => void respondIntro(i.id, 'decline')}
                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-danger hover:text-danger"
                  >
                    Decline
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Message leads: every received message is a lead ─────────────── */}
      {messageLeads.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <MessageCircle size={14} /> Message leads ({messageLeads.length})
          </h2>
          <ul className="space-y-3">
            {messageLeads.map((c) => {
              const other = c.otherUser;
              const fromThem = c.lastMessage && c.lastMessage.senderId !== user?.id;
              return (
                <motion.li
                  key={c.id}
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase text-primary">
                      {other ? (other.firstName?.[0] ?? '') + (other.lastName?.[0] ?? '') : '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {other ? `${other.firstName} ${other.lastName}` : 'Member'}
                        </p>
                        {c.unread && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            New
                          </span>
                        )}
                      </div>
                      {c.lastMessage && (
                        <p className="truncate text-sm text-gray-600">
                          {fromThem ? '' : 'You: '}
                          {c.lastMessage.text.slice(0, 90)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/messages?c=${c.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                  >
                    <MessageCircle size={12} /> Open conversation
                  </Link>
                </motion.li>
              );
            })}
          </ul>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
            <UserCheck size={14} /> Consumer leads
          </h2>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              filter === f.key
                ? 'bg-primary text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-white shadow-sm" />
          ))}
        </div>
      )}

      {!loading && leads.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">
            No leads yet. When consumers click &ldquo;Connect&rdquo; on one of your listings from
            the life-events connector, they&rsquo;ll show up here.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((lead) => (
          <motion.li
            key={lead.id}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">
                    {lead.consumer.firstName} {lead.consumer.lastName}
                  </p>
                  <StatusBadge status={lead.status} />
                </div>
                <p className="text-xs text-gray-500">
                  {lead.eventType.replace(/_/g, ' ').toLowerCase()} ·{' '}
                  {new Date(lead.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  on{' '}
                  <Link
                    href={`/listing/${lead.listing.slug}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {lead.listing.name}
                  </Link>
                </p>
              </div>
              <div className="flex flex-col gap-1 text-sm md:items-end">
                <a
                  href={`mailto:${lead.consumer.email}`}
                  className="inline-flex items-center gap-1 text-gray-700 hover:text-primary"
                >
                  <Mail size={14} /> {lead.consumer.email}
                </a>
                {lead.consumer.phone && (
                  <a
                    href={`tel:${lead.consumer.phone}`}
                    className="inline-flex items-center gap-1 text-gray-700 hover:text-primary"
                  >
                    <Phone size={14} /> {lead.consumer.phone}
                  </a>
                )}
              </div>
            </div>
            {lead.notes && (
              <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <MessageCircle size={13} className="mr-1 inline text-gray-400" />
                {lead.notes}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {lead.status === 'PENDING' && (
                <button
                  onClick={() => void setStatus(lead.id, 'CONTACTED')}
                  className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Mark contacted
                </button>
              )}
              {lead.status !== 'CONVERTED' && (
                <button
                  onClick={() => void setStatus(lead.id, 'CONVERTED')}
                  className="inline-flex items-center gap-1 rounded-full bg-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-success/90"
                >
                  <UserCheck size={13} /> Mark converted
                </button>
              )}
              {lead.status !== 'EXPIRED' && lead.status !== 'CONVERTED' && (
                <button
                  onClick={() => void setStatus(lead.id, 'EXPIRED')}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <XCircle size={13} /> Expire
                </button>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const colors: Record<LeadStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    CONTACTED: 'bg-blue-100 text-blue-700',
    CONVERTED: 'bg-success/10 text-success',
    EXPIRED: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}
