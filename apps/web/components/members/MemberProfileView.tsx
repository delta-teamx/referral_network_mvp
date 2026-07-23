'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Briefcase, Calendar, Film, HandCoins, MapPin, MessageSquare, Send, Target } from 'lucide-react';
import { fadeInUp } from '../../lib/animations';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { BookingModal } from '../booking/BookingModal';

interface PublicProfile {
  id: string;
  businessName: string;
  industry: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  servicesOffered: string[];
  yearsInBusiness: number | null;
  icpIndustries: string[];
  icpRoles: string[];
  canReferIndustries: string[];
  city: string | null;
  state: string | null;
  openToBarter: boolean;
  barterOfferings: string[];
  barterWants: string[];
  barterNotes: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

/** Inline form: send this member a client referral. */
function ReferClientForm({
  targetUserId,
  targetName,
  accessToken,
  done,
  sending,
  setSending,
  setDone,
  onError,
}: {
  targetUserId: string;
  targetName: string;
  accessToken: string | null;
  done: boolean;
  sending: boolean;
  setSending: (v: boolean) => void;
  setDone: (v: boolean) => void;
  onError: (m: string) => void;
}) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const form = new FormData(e.currentTarget);
    setSending(true);
    try {
      await api.post(
        '/api/v1/referrals',
        {
          receiverUserId: targetUserId,
          clientName: String(form.get('clientName') ?? '').trim() || undefined,
          clientEmail: String(form.get('clientEmail') ?? '').trim() || undefined,
          clientPhone: String(form.get('clientPhone') ?? '').trim() || undefined,
          notes: String(form.get('notes') ?? '').trim() || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setDone(true);
    } catch (err) {
      onError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (status ${err.status})` : ''}`
          : 'Could not send referral',
      );
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-sm text-white">
        ✅ Referral sent — {targetName} has been notified and it&rsquo;s in both of your
        Referrals tabs.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2 rounded-xl bg-white/10 p-4">
      <p className="text-sm font-semibold text-white">Refer a client to {targetName}</p>
      <input
        name="clientName"
        placeholder="Client name"
        required
        className="w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="clientEmail"
          type="email"
          placeholder="Client email (optional)"
          className="w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900"
        />
        <input
          name="clientPhone"
          placeholder="Client phone (optional)"
          className="w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900"
        />
      </div>
      <textarea
        name="notes"
        rows={2}
        placeholder="What does the client need?"
        className="w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900"
      />
      <button
        type="submit"
        disabled={sending}
        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-primary hover:bg-white/90 disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send referral'}
      </button>
    </form>
  );
}

/**
 * The member profile card — used inside the dashboard (with sidebar) and on
 * the marketing site's public member page. Fetches by member id (profile id or
 * user id) and offers Book-a-call + Message + Refer-a-client to signed-in viewers.
 */
export function MemberProfileView({ id }: { id: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [referOpen, setReferOpen] = useState(false);
  const [referSending, setReferSending] = useState(false);
  const [referDone, setReferDone] = useState(false);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  async function startConversation() {
    if (!profile) return;
    // A click must never be a silent no-op: with no session token in this tab,
    // route through login and come straight back here.
    if (!accessToken) {
      window.location.href =
        '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    setMessaging(true);
    setError(null);
    try {
      const conversation = await api.post<{ id: string }>(
        '/api/v1/messages/start',
        { targetUserId: profile.user.id },
        { accessToken: accessToken ?? undefined },
      );
      // Land directly in this lead's thread, not just on the messages page.
      router.push(`/dashboard/messages?c=${conversation.id}`);
    } catch (err) {
      // Include the HTTP status so a failure is self-diagnosing from the UI.
      setError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (status ${err.status})` : ''}`
          : 'Could not start the conversation.',
      );
    } finally {
      setMessaging(false);
    }
  }

  useEffect(() => {
    if (!id) {
      setError('Missing member ID');
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<PublicProfile>(`/api/v1/profiles/public/${id}`);
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Profile not found');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-danger/30 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-lg font-semibold text-danger">Profile not available</p>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    );
  }

  const initials =
    (profile.user.firstName?.[0] ?? '') + (profile.user.lastName?.[0] ?? '');

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-primary/90 to-blue-600 p-8 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          {profile.photoUrl || profile.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl ?? profile.user.avatarUrl ?? ''}
              alt={initials}
              className="h-20 w-20 rounded-2xl border-2 border-white/40 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/40 bg-white/15 text-2xl font-bold uppercase shadow-lg">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold md:text-3xl">{profile.businessName}</h1>
            <p className="text-sm text-white/85">
              {profile.user.firstName} {profile.user.lastName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                {profile.industry}
              </span>
              {profile.yearsInBusiness !== null && profile.yearsInBusiness > 0 && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  {profile.yearsInBusiness}+ yrs in business
                </span>
              )}
              {(profile.city || profile.state) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  <MapPin size={11} />
                  {[profile.city, profile.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        {profile.headline && (
          <p className="relative mt-4 max-w-xl text-white/90">{profile.headline}</p>
        )}
        {error && (
          <p className="mt-3 rounded-md bg-white/15 px-3 py-2 text-sm text-white">{error}</p>
        )}
        {user && user.id !== profile.user.id && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-lg shadow-black/10 transition hover:bg-white/90"
            >
              <Calendar size={14} /> Book a call
            </button>
            <button
              onClick={() => void startConversation()}
              disabled={messaging}
              className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              <MessageSquare size={14} /> {messaging ? 'Opening…' : 'Message'}
            </button>
            <button
              onClick={() => setReferOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Send size={14} /> Refer a client
            </button>
          </div>
        )}
        {referOpen && user && (
          <ReferClientForm
            targetUserId={profile.user.id}
            targetName={profile.user.firstName}
            accessToken={accessToken}
            done={referDone}
            sending={referSending}
            setSending={setReferSending}
            setDone={setReferDone}
            onError={(m) => setError(m)}
          />
        )}
        {!user && (
          <div className="mt-4">
            <a
              href={`/login?next=${encodeURIComponent(`/dashboard/members/profile?id=${profile.id}`)}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-lg shadow-black/10 transition hover:bg-white/90"
            >
              <Calendar size={14} /> Log in to book a call
            </a>
          </div>
        )}
      </div>

      <BookingModal
        hostUserId={profile.user.id}
        hostName={`${profile.user.firstName} ${profile.user.lastName}`}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />

      {/* Body */}
      <div className="space-y-5 p-6 md:p-8">
        {profile.bio && (
          <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              About
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{profile.bio}</p>
          </section>
        )}

        {profile.videoUrl && (
          <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Film size={14} /> Video Introduction
            </h2>
            <video
              src={profile.videoUrl}
              controls
              className="w-full rounded-xl"
              preload="metadata"
            />
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {(profile.icpIndustries.length > 0 || profile.icpRoles.length > 0) && (
            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Target size={14} className="text-primary" /> Who they want to meet
              </h2>
              <div className="flex flex-wrap gap-2">
                {[...profile.icpIndustries, ...profile.icpRoles].map((s) => (
                  <span key={s} className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {profile.canReferIndustries.length > 0 && (
            <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <HandCoins size={14} className="text-emerald-500" /> Refers clients to
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.canReferIndustries.map((s) => (
                  <span key={s} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {profile.servicesOffered.length > 0 && (
          <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Briefcase size={14} className="text-primary" /> Services Offered
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.servicesOffered.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary"
                >
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}

        {profile.openToBarter && (
          <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <HandCoins size={14} className="text-amber-500" /> Open to Barter
            </h2>
            {profile.barterOfferings.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-600">Offerings:</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {profile.barterOfferings.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.barterWants.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-600">Looking for:</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {profile.barterWants.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.barterNotes && (
              <p className="mt-1 text-xs italic text-gray-500">{profile.barterNotes}</p>
            )}
          </section>
        )}
      </div>
    </motion.div>
  );
}
