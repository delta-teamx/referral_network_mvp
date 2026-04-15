'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Globe, Mail, MapPin, Phone, ShieldCheck, Star } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';

interface ListingDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  avgRating: string | number;
  reviewCount: number;
  trustScore: string | number;
  isVerified: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string };
  photos: { id: string; url: string; caption: string | null }[];
  _count: { reviews: number; referrals: number };
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  text: string;
  isVerified: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string; avatarUrl: string | null };
}

export default function ListingDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [detail, rev] = await Promise.all([
          api.get<ListingDetail>(`/api/v1/listings/${slug}`),
          api.get<ReviewItem[]>(`/api/v1/listings/${slug}/reviews`).catch(() => [] as ReviewItem[]),
        ]);
        if (!cancelled) {
          setListing(detail);
          setReviews(rev);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Listing not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (slug) void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-48 rounded-2xl bg-gray-200" />
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16 text-center">
        <p className="mb-6 text-lg text-gray-600">{error ?? 'Listing not found.'}</p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse the directory →
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cover */}
      <div className="relative h-56 bg-gradient-to-br from-primary via-[#174a6e] to-[#0d3650]">
        <div className="mx-auto flex h-full max-w-6xl items-end px-6 pb-6">
          <Link
            href="/search"
            className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
          >
            <ArrowLeft size={14} /> Back to search
          </Link>
        </div>
      </div>

      <div className="mx-auto -mt-16 max-w-6xl px-6 pb-16">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">
              {listing.category.name}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{listing.name}</h1>
              {listing.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  <ShieldCheck size={12} />
                  Verified
                </span>
              )}
              {listing.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  Featured
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1 text-gray-700">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                {Number(listing.avgRating).toFixed(1)}
                <span className="text-gray-400">({listing.reviewCount} reviews)</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                Trust {Number(listing.trustScore).toFixed(1)} / 10
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500">
                <MapPin size={14} />
                {listing.city}, {listing.state} {listing.zipCode}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/connect?listing=${listing.slug}`}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              Request a quote
            </Link>
            <button className="rounded-full border border-primary/30 bg-primary-light px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white">
              Refer this business
            </button>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <section className="space-y-6">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h2 className="mb-3 text-lg font-semibold text-gray-900">About</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {listing.description}
              </p>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Reviews</h2>
                <span className="text-sm text-gray-500">
                  {listing.reviewCount} total · showing {reviews.length}
                </span>
              </div>
              {reviews.length === 0 ? (
                <p className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                  Be the first to review this business.
                </p>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {r.user.firstName} {r.user.lastName[0]}.
                        </p>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} size={12} className="fill-amber-400" />
                          ))}
                        </div>
                        {r.isVerified && (
                          <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                            Verified
                          </span>
                        )}
                      </div>
                      {r.title && <p className="text-sm font-medium text-gray-900">{r.title}</p>}
                      <p className="text-sm text-gray-700">{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </section>

          <aside className="space-y-4">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2 text-gray-700">
                  <MapPin size={14} className="mt-0.5 text-gray-400" />
                  <span>
                    {listing.address}
                    <br />
                    {listing.city}, {listing.state} {listing.zipCode}
                  </span>
                </li>
                {listing.phone && (
                  <li className="flex items-center gap-2 text-gray-700">
                    <Phone size={14} className="text-gray-400" />
                    <a href={`tel:${listing.phone}`} className="hover:text-primary">
                      {listing.phone}
                    </a>
                  </li>
                )}
                {listing.email && (
                  <li className="flex items-center gap-2 text-gray-700">
                    <Mail size={14} className="text-gray-400" />
                    <a href={`mailto:${listing.email}`} className="hover:text-primary">
                      {listing.email}
                    </a>
                  </li>
                )}
                {listing.website && (
                  <li className="flex items-center gap-2 text-gray-700">
                    <Globe size={14} className="text-gray-400" />
                    <a
                      href={listing.website}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary"
                    >
                      Visit website
                    </a>
                  </li>
                )}
              </ul>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Network stats</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Reviews</dt>
                  <dd className="font-semibold text-gray-900">{listing._count.reviews}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Referrals sent / received</dt>
                  <dd className="font-semibold text-gray-900">{listing._count.referrals}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Trust score</dt>
                  <dd className="font-semibold text-gray-900">
                    {Number(listing.trustScore).toFixed(1)} / 10
                  </dd>
                </div>
              </dl>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-primary/20 bg-primary-light p-5"
            >
              <Clock size={18} className="mb-2 text-primary" />
              <p className="mb-1 text-sm font-semibold text-gray-900">Hours</p>
              <p className="text-xs text-gray-600">
                Business hours aren&rsquo;t set yet. Contact the business for availability.
              </p>
            </motion.div>
          </aside>
        </div>
      </div>
    </main>
  );
}
