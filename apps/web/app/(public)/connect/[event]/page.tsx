'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, ShieldCheck, Sparkles, Star } from 'lucide-react';
import type { EventType } from '@refnet/shared';
import { EVENT_TYPES, EVENT_TYPE_META } from '@refnet/shared';
import { fadeInUp, staggerContainer } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';

interface MatchedListing {
  listingId: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  city: string;
  state: string;
  categoryName: string;
  avgRating: number;
  reviewCount: number;
  trustScore: number;
  isVerified: boolean;
  score: number;
}

function slugToEventType(slug: string): EventType | null {
  const normalised = slug.toUpperCase().replace(/-/g, '_');
  return (EVENT_TYPES as readonly string[]).includes(normalised) ? (normalised as EventType) : null;
}

export default function ConnectEventPage() {
  const params = useParams<{ event: string }>();
  const eventType = slugToEventType(params.event ?? '');
  if (!eventType) notFound();

  const meta = EVENT_TYPE_META[eventType];

  const [zip, setZip] = useState('');
  const [results, setResults] = useState<MatchedListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a 5-digit ZIP code.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<MatchedListing[]>('/api/v1/connect/match', {
        eventType,
        zip,
      });
      setResults(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Match failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-light/40 to-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/connect"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary"
        >
          <ArrowLeft size={14} /> All life events
        </Link>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            <Sparkles size={14} />
            Life event
          </p>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {meta.label}
          </h1>
          <p className="mb-6 text-base text-gray-600">{meta.description}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <MapPin size={16} className="text-gray-400" />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="Your ZIP (e.g. 63104)"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? 'Matching…' : 'Match me'}
            </button>
          </form>
          {error && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </motion.div>

        {results && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {results.length === 0 ? 'No matches yet' : `${results.length} matched pros`}
              </h2>
              {results.length > 0 && (
                <span className="text-xs text-gray-500">Ranked by match score</span>
              )}
            </div>

            {results.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-600">
                No pros nearby (yet). Try a different ZIP or browse the full{' '}
                <Link href="/search" className="font-semibold text-primary hover:underline">
                  directory
                </Link>
                .
              </div>
            )}

            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {results.map((m, idx) => (
                <motion.li key={m.listingId} variants={fadeInUp}>
                  <Link
                    href={`/listing/${m.slug}`}
                    className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary sm:flex">
                        #{idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                          {m.categoryName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900 group-hover:text-primary">
                            {m.name}
                          </p>
                          {m.isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                              <ShieldCheck size={10} />
                              Verified
                            </span>
                          )}
                        </div>
                        {m.shortDescription && (
                          <p className="mt-1 text-sm text-gray-600">{m.shortDescription}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {Number(m.avgRating).toFixed(1)}
                            <span className="text-gray-400">({m.reviewCount})</span>
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-500">
                            {m.city}, {m.state}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 font-semibold text-primary">
                            Trust {Number(m.trustScore).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                        Match {m.score.toFixed(1)}
                      </span>
                      <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">
                        Connect →
                      </span>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          </section>
        )}
      </div>
    </main>
  );
}
