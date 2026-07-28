'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  Film,
  HandCoins,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Send,
  Target,
} from 'lucide-react';
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
  linkedinUrl: string | null;
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
      <p className="mt-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
        ✅ Referral sent - {targetName} has been notified and it&rsquo;s on both of your
        pipelines.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">Refer a client to {targetName}</p>
      <input
        name="clientName"
        placeholder="Client name"
        required
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          name="clientEmail"
          type="email"
          placeholder="Client email (optional)"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
        />
        <input
          name="clientPhone"
          placeholder="Client phone (optional)"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
        />
      </div>
      <textarea
        name="notes"
        rows={2}
        placeholder="What does the client need?"
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        disabled={sending}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send referral'}
      </button>
    </form>
  );
}

/**
 * The member profile - a clean CV-style layout: identity + contact block on
 * top, details in the main column, video and quick facts in the side panel.
 * Used inside the dashboard (with sidebar) and on the public member page.
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
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    );
  }

  const initials =
    (profile.user.firstName?.[0] ?? '') + (profile.user.lastName?.[0] ?? '');
  const location = [profile.city, profile.state].filter(Boolean).join(', ');

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mx-auto max-w-4xl">
      {/* ── Identity card (CV header) ─────────────────────────────── */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start gap-6">
          {profile.photoUrl || profile.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoUrl ?? profile.user.avatarUrl ?? ''}
              alt={initials}
              className="h-28 w-28 rounded-2xl border border-gray-200 object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-gray-200 bg-primary-light text-3xl font-bold uppercase text-primary">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {profile.user.firstName} {profile.user.lastName}
            </h1>
            <p className="text-base font-semibold text-primary">{profile.businessName}</p>
            {profile.headline && <p className="mt-1 text-sm text-gray-600">{profile.headline}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={14} className="text-gray-400" /> {profile.industry}
              </span>
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-400" /> {location}
                </span>
              )}
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <Linkedin size={14} /> LinkedIn
                </a>
              )}
              {profile.yearsInBusiness !== null && profile.yearsInBusiness > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" /> {profile.yearsInBusiness}+ years
                  in business
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {user && user.id !== profile.user.id && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-5">
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            >
              <Calendar size={14} /> Book a call
            </button>
            <button
              onClick={() => void startConversation()}
              disabled={messaging}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <MessageSquare size={14} /> {messaging ? 'Opening…' : 'Message'}
            </button>
            <button
              onClick={() => setReferOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
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
          <div className="mt-5 border-t border-gray-100 pt-5">
            <a
              href={`/login?next=${encodeURIComponent(`/dashboard/members/profile?id=${profile.id}`)}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
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

      {/* ── Two-column body: details + side panel ─────────────────── */}
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 md:col-span-2">
          {profile.bio && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                About
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {profile.bio}
              </p>
            </section>
          )}

          {(profile.icpIndustries.length > 0 || profile.icpRoles.length > 0) && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <HandCoins size={14} className="text-emerald-500" /> Refers clients to
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.canReferIndustries.map((s) => (
                  <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {profile.servicesOffered.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Briefcase size={14} className="text-primary" /> Services offered
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
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <HandCoins size={14} className="text-amber-500" /> Open to barter
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

        {/* Side panel */}
        <aside className="space-y-5">
          {profile.videoUrl && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <Film size={14} className="text-primary" /> Video introduction
              </h2>
              <video src={profile.videoUrl} controls className="w-full rounded-xl" preload="metadata" />
            </section>
          )}

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              At a glance
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Business</dt>
                <dd className="text-right font-medium text-gray-900">{profile.businessName}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Industry</dt>
                <dd className="text-right font-medium text-gray-900">{profile.industry}</dd>
              </div>
              {location && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500">Location</dt>
                  <dd className="text-right font-medium text-gray-900">{location}</dd>
                </div>
              )}
              {profile.yearsInBusiness !== null && profile.yearsInBusiness > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-gray-500">Experience</dt>
                  <dd className="text-right font-medium text-gray-900">
                    {profile.yearsInBusiness}+ years
                  </dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-500">Barter</dt>
                <dd className="text-right font-medium text-gray-900">
                  {profile.openToBarter ? 'Open to barter' : 'Not right now'}
                </dd>
              </div>
            </dl>
            {user && user.id !== profile.user.id && (
              <button
                onClick={() => void startConversation()}
                disabled={messaging}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <Mail size={12} /> {messaging ? 'Opening…' : 'Send a message'}
              </button>
            )}
          </section>
        </aside>
      </div>
    </motion.div>
  );
}
