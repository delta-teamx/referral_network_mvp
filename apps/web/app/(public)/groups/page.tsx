'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, MapPin, Plus, Search as SearchIcon, Users } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

interface GroupCard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  meetingSchedule: string | null;
  memberCount: number;
  maxMembers: number;
}

export default function GroupsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function join(groupId: string) {
    if (!accessToken) return;
    setJoiningId(groupId);
    try {
      await api.post(
        `/api/v1/groups/${groupId}/join`,
        {},
        { accessToken: accessToken ?? undefined },
      );
      setJoinedIds((s) => new Set([...s, groupId]));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join');
    } finally {
      setJoiningId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<GroupCard[]>('/api/v1/groups', {
          query: { q: q || undefined, state: state || undefined, limit: 24 },
        });
        if (!cancelled) setGroups(data);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [q, state]);

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Local networking
              </p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">
                Find a networking group near you
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Weekly or monthly BNI-style circles. Every seat is one category — no competition
                inside the room, only referrals.
              </p>
            </div>
            {user && (
              <Link
                href="/groups/new"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                <Plus size={14} /> Start a group
              </Link>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2 md:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-primary">
              <SearchIcon size={16} className="text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search groups by name…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 md:w-40">
              <MapPin size={16} className="text-gray-400" />
              <input
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="State"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">No groups match.</p>
            <p className="mt-1 text-sm text-gray-600">
              {user
                ? 'Be the first — start a group and invite your peers.'
                : 'Log in to start a group in your city.'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {groups.map((g) => {
              const pct = Math.round((g.memberCount / g.maxMembers) * 100);
              const joined = joinedIds.has(g.id);
              const atCapacity = g.memberCount >= g.maxMembers;
              return (
                <motion.div
                  key={g.id}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-semibold text-primary">
                      <MapPin size={12} />
                      {g.city}, {g.state}
                    </span>
                    <span className="text-xs text-gray-500">
                      {g.memberCount}/{g.maxMembers}
                    </span>
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">{g.name}</h3>
                  {g.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-600">{g.description}</p>
                  )}
                  {g.meetingSchedule && (
                    <p className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500">
                      <Users size={12} /> {g.meetingSchedule}
                    </p>
                  )}
                  <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {user ? (
                    joined ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/5 px-4 py-1.5 text-xs font-semibold text-success">
                        <Check size={12} /> Joined
                      </span>
                    ) : (
                      <button
                        onClick={() => void join(g.id)}
                        disabled={joiningId === g.id || atCapacity}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {joiningId === g.id
                          ? 'Joining…'
                          : atCapacity
                            ? 'At capacity'
                            : 'Join group'}
                      </button>
                    )
                  ) : (
                    <Link
                      href="/login?next=/groups"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Log in to join →
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>
    </main>
  );
}
