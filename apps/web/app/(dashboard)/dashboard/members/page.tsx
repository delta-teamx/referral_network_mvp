'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Handshake, MapPin, Search, Users, Video } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface Member {
  id: string;
  userId: string;
  businessName: string;
  industry: string;
  headline: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  city: string | null;
  state: string | null;
  icpIndustries: string[];
  openToBarter: boolean;
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

export default function MembersDirectoryPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');

  async function load(filters?: { q?: string; industry?: string; city?: string }) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Member[]>('/api/v1/profiles/search', {
        query: {
          q: filters?.q || undefined,
          industry: filters?.industry || undefined,
          city: filters?.city || undefined,
          limit: 50,
        },
        accessToken: accessToken ?? undefined,
      });
      setMembers(data.filter((m) => m.user.id !== me?.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load({ q, industry, city });
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Directory</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Users size={22} /> Members
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Search everyone in the network, see who they serve and who they want to meet, watch their
          intro video, then message them or book a call.
        </p>
      </header>

      {/* Search */}
      <form onSubmit={onSearch} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, business or headline…"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Search
          </button>
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <Users size={32} className="mx-auto mb-3 text-primary" />
          <h3 className="mb-1 text-lg font-semibold text-gray-900">No members found</h3>
          <p className="text-sm text-gray-600">Try a different search, or check back as more businesses join.</p>
        </div>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {members.map((m) => {
            const photo = m.photoUrl ?? m.user.avatarUrl;
            const name = `${m.user.firstName} ${m.user.lastName}`.trim();
            return (
              <motion.li key={m.id} variants={fadeInUp}>
                <Link
                  href={`/dashboard/members/profile?id=${m.id}`}
                  className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-3">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={name} className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">
                        {m.user.firstName[0]}
                        {m.user.lastName[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{m.businessName}</p>
                      <p className="truncate text-xs text-gray-500">{name}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-primary">{m.industry}</p>
                  {m.headline && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{m.headline}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.videoUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                        <Video size={11} /> Video
                      </span>
                    )}
                    {m.openToBarter && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Handshake size={11} /> Barter
                      </span>
                    )}
                    {(m.city || m.state) && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={11} /> {[m.city, m.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>

                  {m.icpIndustries.length > 0 && (
                    <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Wants to meet:</span>{' '}
                      {m.icpIndustries.slice(0, 3).join(', ')}
                      {m.icpIndustries.length > 3 ? '…' : ''}
                    </p>
                  )}

                  <span className="mt-4 inline-block text-sm font-semibold text-primary">View profile →</span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
