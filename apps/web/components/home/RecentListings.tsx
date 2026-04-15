'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Star } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { api } from '../../lib/api';
import { SectionShell } from './SectionShell';

interface Listing {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  city: string;
  state: string;
  avgRating: string | number;
  reviewCount: number;
  trustScore: string | number;
  isVerified: boolean;
  category: { name: string; slug: string };
}

const FALLBACK_ACCENTS = [
  'from-blue-500 to-primary',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-violet-600',
  'from-green-500 to-emerald-600',
];

export function RecentListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Listing[]>('/api/v1/listings/recent', { query: { limit: 6 } });
        if (cancelled) return;
        setListings(data);
        setState(data.length === 0 ? 'empty' : 'loaded');
      } catch {
        if (!cancelled) setState('empty');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionShell
      eyebrow="Recently added"
      title="Fresh businesses joining the network"
      subtitle="Every listing is verified. Every business owner has put skin in the game — a real name, a real address, a real phone number."
    >
      {state === 'loading' && <ListingsSkeleton />}

      {state === 'empty' && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">
            The directory is warming up. Start the API and run{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              pnpm --filter @refnet/api prisma:seed
            </code>{' '}
            to populate demo listings.
          </p>
        </div>
      )}

      {state === 'loaded' && (
        <motion.div
          variants={staggerContainer}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {listings.map((listing, idx) => (
            <motion.div key={listing.id} variants={fadeInUp}>
              <Link
                href={`/listing/${listing.slug}`}
                className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`relative h-24 bg-gradient-to-br ${
                    FALLBACK_ACCENTS[idx % FALLBACK_ACCENTS.length]
                  }`}
                >
                  {listing.isVerified && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-success backdrop-blur">
                      <ShieldCheck size={12} />
                      Verified
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                    {listing.category.name}
                  </p>
                  <h3 className="mb-1 text-lg font-semibold text-gray-900 group-hover:text-primary">
                    {listing.name}
                  </h3>
                  {listing.shortDescription && (
                    <p className="mb-4 text-sm leading-relaxed text-gray-600">
                      {listing.shortDescription}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        {Number(listing.avgRating).toFixed(1)}
                        <span className="text-gray-400">({listing.reviewCount})</span>
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">
                        {listing.city}, {listing.state}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      Trust {Number(listing.trustScore).toFixed(1)}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

      {state === 'loaded' && (
        <motion.div variants={fadeInUp} className="mt-10 text-center">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            Browse the full directory →
          </Link>
        </motion.div>
      )}
    </SectionShell>
  );
}

function ListingsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="h-24 animate-pulse bg-gray-200" />
          <div className="space-y-2 p-5">
            <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
