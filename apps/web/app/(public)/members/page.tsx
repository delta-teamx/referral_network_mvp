'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Briefcase, Calendar, Film, HandCoins, MapPin } from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { BookingModal } from '../../../components/booking/BookingModal';

interface PublicProfile {
  id: string;
  businessName: string;
  industry: string;
  headline: string | null;
  bio: string | null;
  videoUrl: string | null;
  servicesOffered: string[];
  yearsInBusiness: number | null;
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

function MemberProfileInner() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

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
      <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-danger/30 bg-white p-8 text-center shadow-sm">
          <p className="mb-2 text-lg font-semibold text-danger">Profile not available</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="h-64 animate-pulse rounded-3xl bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  const initials =
    (profile.user.firstName?.[0] ?? '') + (profile.user.lastName?.[0] ?? '');

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-primary to-blue-600 p-8 text-white">
          <div className="flex items-center gap-4">
            {profile.user.avatarUrl ? (
              <img
                src={profile.user.avatarUrl}
                alt={initials}
                className="h-16 w-16 rounded-full border-2 border-white/50 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/50 bg-white/20 text-xl font-bold uppercase">
                {initials}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.businessName}</h1>
              <p className="text-sm text-white/80">{profile.industry}</p>
            </div>
          </div>
          {profile.headline && (
            <p className="mt-3 text-white/90">{profile.headline}</p>
          )}
          {(profile.city || profile.state) && (
            <p className="mt-2 flex items-center gap-1 text-sm text-white/70">
              <MapPin size={14} />
              {[profile.city, profile.state].filter(Boolean).join(', ')}
            </p>
          )}
          {user && user.id !== profile.user.id && (
            <div className="mt-4">
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-lg shadow-black/10 transition hover:bg-white/90"
              >
                <Calendar size={14} /> Book a call with {profile.user.firstName}
              </button>
            </div>
          )}
          {!user && (
            <div className="mt-4">
              <a
                href={`/login?next=/members?id=${profile.id}`}
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
        <div className="space-y-6 p-8">
          {/* Bio */}
          {profile.bio && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                About
              </h2>
              <p className="whitespace-pre-line text-sm text-gray-700">{profile.bio}</p>
            </section>
          )}

          {/* Video */}
          {profile.videoUrl && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
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

          {/* Services offered */}
          {profile.servicesOffered.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <Briefcase size={14} /> Services Offered
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

          {/* Barter */}
          {profile.openToBarter && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
                <HandCoins size={14} /> Open to Barter
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
    </main>
  );
}

export default function MemberProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50" />
      }
    >
      <MemberProfileInner />
    </Suspense>
  );
}
