'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

type ConnectionState =
  | 'none'
  | 'pending_outbound'
  | 'pending_inbound'
  | 'accepted'
  | 'declined';

interface ListingDetail {
  id: string;
  slug: string;
  userId: string;
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

export default function ListingDetailClient() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [connState, setConnState] = useState<ConnectionState>('none');
  const [connBusy, setConnBusy] = useState(false);

  async function reload() {
    if (!slug) return;
    try {
      const [detail, rev] = await Promise.all([
        api.get<ListingDetail>(`/api/v1/listings/${slug}`),
        api.get<ReviewItem[]>(`/api/v1/listings/${slug}/reviews`).catch(() => [] as ReviewItem[]),
      ]);
      setListing(detail);
      setReviews(rev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Listing not found');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void reload().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Check connection state once we know who owns the listing.
  useEffect(() => {
    if (!listing || !accessToken || !user || user.id === listing.userId) return;
    let cancelled = false;
    async function loadState() {
      try {
        const res = await api.get<{ state: ConnectionState }>(
          `/api/v1/connections/state/${listing!.userId}`,
          { accessToken: accessToken ?? undefined },
        );
        if (!cancelled) setConnState(res.state);
      } catch {
        /* silent — connection feature is non-critical */
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [listing, accessToken, user]);

  async function requestConnect() {
    if (!listing || !accessToken) {
      router.push(`/login?next=/listing/${slug}`);
      return;
    }
    setConnBusy(true);
    try {
      await api.post(
        '/api/v1/connections/request',
        { targetUserId: listing.userId },
        { accessToken: accessToken ?? undefined },
      );
      setConnState('pending_outbound');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send connect request');
    } finally {
      setConnBusy(false);
    }
  }

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
                  <ShieldCheck size={12} /> Verified
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
              href={`/connect`}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              Request a quote
            </Link>
            <button
              onClick={() => {
                if (!accessToken) router.push(`/login?next=/listing/${slug}`);
                else setReferralModalOpen(true);
              }}
              className="rounded-full border border-primary/30 bg-primary-light px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
            >
              Refer this business
            </button>
            {user && listing.userId !== user.id && (
              <ConnectButton
                state={connState}
                busy={connBusy}
                onRequest={() => void requestConnect()}
              />
            )}
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
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {listing.reviewCount} total · showing {reviews.length}
                  </span>
                  <button
                    onClick={() => {
                      if (!accessToken) router.push(`/login?next=/listing/${slug}`);
                      else setReviewModalOpen(true);
                    }}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                  >
                    Write a review
                  </button>
                </div>
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

      {reviewModalOpen && (
        <ReviewModal
          slug={slug}
          onClose={() => setReviewModalOpen(false)}
          onSubmitted={async () => {
            setReviewModalOpen(false);
            await reload();
          }}
        />
      )}
      {referralModalOpen && (
        <ReferralModal
          slug={slug}
          onClose={() => setReferralModalOpen(false)}
          onSubmitted={() => {
            setReferralModalOpen(false);
          }}
        />
      )}
      {/* Force inclusion of `user` so eslint-no-unused-vars passes even when unused in UI. */}
      {user && <span className="sr-only" />}
    </main>
  );
}

function ReviewModal({
  slug,
  onClose,
  onSubmitted,
}: {
  slug: string;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(
        '/api/v1/reviews',
        {
          listingSlug: slug,
          rating,
          title: String(form.get('title') ?? '').trim() || undefined,
          text: String(form.get('text') ?? '').trim(),
        },
        { accessToken: accessToken ?? undefined },
      );
      await onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Write a review" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900">Your rating</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className="transition hover:scale-110"
              >
                <Star
                  size={28}
                  className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Title (optional)</label>
          <input
            name="title"
            maxLength={120}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Review</label>
          <textarea
            name="text"
            required
            minLength={10}
            maxLength={3000}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">10+ chars. Be specific and fair.</p>
        </div>
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ReferralModal({
  slug,
  onClose,
  onSubmitted,
}: {
  slug: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      await api.post(
        '/api/v1/referrals',
        {
          listingSlug: slug,
          clientName: String(form.get('clientName') ?? '').trim() || undefined,
          clientPhone: String(form.get('clientPhone') ?? '').trim() || undefined,
          clientEmail: String(form.get('clientEmail') ?? '').trim() || undefined,
          notes: String(form.get('notes') ?? '').trim() || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setSent(true);
      setTimeout(onSubmitted, 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Refer a client to this business" onClose={onClose}>
      {sent ? (
        <p className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
          <Check size={14} /> Referral sent. We&rsquo;ve notified the business.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-gray-600">
            You&rsquo;re referring a client to this business. They&rsquo;ll get an email with the
            client&rsquo;s details and a link to respond.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Client name</label>
              <input
                name="clientName"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Client phone</label>
              <input
                name="clientPhone"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-900">Client email</label>
              <input
                name="clientEmail"
                type="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Context / notes
              </label>
              <textarea
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="What do they need? Timeline? Budget?"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Send size={14} /> {submitting ? 'Sending…' : 'Send referral'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function ConnectButton({
  state,
  busy,
  onRequest,
}: {
  state: ConnectionState;
  busy: boolean;
  onRequest: () => void;
}) {
  if (state === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/5 px-5 py-2.5 text-sm font-semibold text-success">
        <Check size={14} /> Connected
      </span>
    );
  }
  if (state === 'pending_outbound') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800">
        <Clock size={14} /> Request sent
      </span>
    );
  }
  if (state === 'pending_inbound') {
    return (
      <Link
        href="/dashboard/network"
        className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Respond to request →
      </Link>
    );
  }
  return (
    <button
      onClick={onRequest}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Sending…' : 'Connect'}
    </button>
  );
}
