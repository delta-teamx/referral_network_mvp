'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, MapPin, Search as SearchIcon, ShieldCheck, Star } from 'lucide-react';
import { CATEGORY_SEEDS } from '@refnet/shared';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { AuthGate } from '../../../components/auth/AuthGate';

interface ListingCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  city: string;
  state: string;
  zipCode: string;
  avgRating: string | number;
  reviewCount: number;
  trustScore: string | number;
  isVerified: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string; icon: string | null };
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [zip, setZip] = useState(params.get('zip') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [minRating, setMinRating] = useState(params.get('minRating') ?? '');
  const [verifiedOnly, setVerifiedOnly] = useState(params.get('verified') === 'true');
  const [sort, setSort] = useState<'trust' | 'rating' | 'newest'>(
    (params.get('sort') as 'trust' | 'rating' | 'newest') ?? 'trust',
  );

  const [listings, setListings] = useState<ListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const results = await api.get<ListingCard[]>('/api/v1/listings', {
          query: {
            zip: zip || undefined,
            category: category || undefined,
            q: query || undefined,
            minRating: minRating || undefined,
            verified: verifiedOnly ? 'true' : undefined,
            sort,
            limit: 24,
          },
        });
        if (!cancelled) {
          setListings(results);
          setTotal(results.length);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Search failed');
          setListings([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [zip, category, query, minRating, verifiedOnly, sort]);

  function updateUrl() {
    const next = new URLSearchParams();
    if (zip) next.set('zip', zip);
    if (category) next.set('category', category);
    if (query) next.set('q', query);
    if (minRating) next.set('minRating', minRating);
    if (verifiedOnly) next.set('verified', 'true');
    if (sort !== 'trust') next.set('sort', sort);
    router.replace(`/search?${next.toString()}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Member directory</p>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Browse the network</h1>
          <p className="mb-4 text-sm text-gray-500">
            Discover professionals on NRG. Every member has a verified profile,
            AI-matched connections, and booking availability.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateUrl();
            }}
            className="flex flex-col gap-2 md:flex-row md:items-center"
          >
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-primary">
              <SearchIcon size={16} className="text-gray-400" />
              <input
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, specialty…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 md:w-36">
              <MapPin size={16} className="text-gray-400" />
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 md:grid-cols-[260px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Filter size={16} /> Filters
            </p>

            <label className="mb-1 block text-xs font-medium text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Any category</option>
              {CATEGORY_SEEDS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-medium text-gray-600">Minimum rating</label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="mb-4 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="4">4+ stars</option>
              <option value="4.5">4.5+ stars</option>
              <option value="4.8">4.8+ stars</option>
            </select>

            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4"
              />
              Verified only
            </label>

            <label className="mb-1 block text-xs font-medium text-gray-600">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'trust' | 'rating' | 'newest')}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="trust">Trust score</option>
              <option value="rating">Avg rating</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {loading ? 'Searching…' : total > 0 ? `${total} results` : 'No results'}
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!loading && listings.length === 0 && !error && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <p className="text-sm text-gray-600">
                No listings match your filters. Try widening the ZIP radius or clearing a filter.
              </p>
            </div>
          )}

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2"
          >
            {listings.map((listing) => (
              <motion.div key={listing.id} variants={fadeInUp}>
                <Link
                  href={`/listing/${listing.slug}`}
                  className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                        {listing.category.name}
                      </p>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary">
                        {listing.name}
                      </h3>
                    </div>
                    {listing.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    )}
                  </div>
                  {listing.shortDescription && (
                    <p className="mb-3 text-sm text-gray-600">{listing.shortDescription}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {Number(listing.avgRating).toFixed(1)}
                      <span className="text-gray-400">({listing.reviewCount})</span>
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">
                      {listing.city}, {listing.state}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      Trust {Math.min(10, Number(listing.trustScore)).toFixed(1)}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <SearchInner />
      </Suspense>
    </AuthGate>
  );
}
