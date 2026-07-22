'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Handshake,
  Sparkles,
  ThumbsDown,
  TrendingUp,
  Users,
  Video,
  X,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

interface IntroSuggestion {
  id: string;
  reason: string;
  matchScore: string;
  matchFactors?: Record<string, number> | null;
  status: string;
  createdAt: string;
  sender: MemberBrief;
  target: MemberBrief;
}

interface MemberBrief {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  memberProfile: {
    businessName: string;
    industry: string;
    headline: string | null;
    videoUrl: string | null;
    city: string | null;
    state: string | null;
    openToBarter?: boolean;
  } | null;
}

export function AiFeed() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [suggestions, setSuggestions] = useState<IntroSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // A profile is "ready to match" once it has an industry and at least one
  // side of the two-sided intent (who they want to meet OR who they refer).
  function isProfileComplete(p: {
    industry?: string | null;
    icpIndustries?: string[] | null;
    canReferIndustries?: string[] | null;
  } | null): boolean {
    if (!p) return false;
    const hasIntent =
      (p.icpIndustries?.length ?? 0) > 0 || (p.canReferIndustries?.length ?? 0) > 0;
    return Boolean(p.industry) && hasIntent;
  }

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      // Always top up first (best-effort): this pulls in members who joined
      // since last time and regenerates the discovery ("you might be
      // interested") picks, so the feed reflects the whole live network rather
      // than a stale snapshot.
      setScanning(true);
      try {
        await api.post('/api/v1/ai/refresh', {}, { accessToken: accessToken ?? undefined });
      } catch {
        // best-effort — fall through and show whatever is persisted
      } finally {
        setScanning(false);
      }

      const data = await api.get<IntroSuggestion[]>('/api/v1/ai/suggestions', {
        accessToken: accessToken ?? undefined,
      });

      // If it's still empty, work out whether the reason is an incomplete
      // profile (point them at onboarding) vs. genuinely no one to show.
      if (data.length === 0) {
        try {
          const me = await api.get<{
            industry?: string;
            icpIndustries?: string[];
            canReferIndustries?: string[];
          }>('/api/v1/profiles/me', { accessToken: accessToken ?? undefined });
          setProfileReady(isProfileComplete(me));
        } catch {
          setProfileReady(false);
        }
      } else {
        setProfileReady(true);
      }

      setSuggestions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function requestIntro(id: string) {
    if (!accessToken) return;
    setBusy(id);
    try {
      await api.post(`/api/v1/ai/introductions/${id}/request`, {}, {
        accessToken: accessToken ?? undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function respond(id: string, action: 'accept' | 'decline') {
    if (!accessToken) return;
    setBusy(id);
    try {
      await api.post(`/api/v1/ai/introductions/${id}/respond`, { action }, {
        accessToken: accessToken ?? undefined,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  // One card per peer. The matcher can create an intro in each direction
  // (me→them and them→me), so collapse to a single card per member and keep the
  // most actionable one (an incoming request > a suggestion I can act on).
  const visibleSuggestions = (() => {
    const rank = (i: IntroSuggestion) => {
      if (i.target.id === user?.id && i.status === 'requested') return 3; // incoming
      if (i.sender.id === user?.id && i.status === 'suggested') return 2; // I can request
      if (i.sender.id === user?.id) return 1;
      return 0;
    };
    const byPeer = new Map<string, IntroSuggestion>();
    for (const intro of suggestions) {
      const peerId = intro.sender.id === user?.id ? intro.target.id : intro.sender.id;
      const existing = byPeer.get(peerId);
      if (
        !existing ||
        rank(intro) > rank(existing) ||
        (rank(intro) === rank(existing) &&
          Number(intro.matchScore) > Number(existing.matchScore))
      ) {
        byPeer.set(peerId, intro);
      }
    }
    return Array.from(byPeer.values()).sort(
      (a, b) => Number(b.matchScore) - Number(a.matchScore),
    );
  })();

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Your AI referral feed
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            People you should meet
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            The AI scans every member&rsquo;s profile - who they serve, who they want to meet, who
            they can refer - and surfaces your best matches. Request an intro and we connect you.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary"
          >
            Edit my profile
          </Link>
          <Link
            href="/dashboard/members"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Users size={14} /> Browse all members
          </Link>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading || scanning ? (
        <div className="space-y-4">
          {scanning && (
            <p className="mb-2 flex items-center gap-2 text-sm text-primary">
              <Sparkles size={14} className="animate-pulse" /> Scanning the network for your best matches…
            </p>
          )}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : visibleSuggestions.length === 0 ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center"
        >
          <Sparkles size={32} className="mx-auto mb-3 text-primary" />
          {!user ? (
            <>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Log in to see your matches</h3>
              <p className="mb-4 text-sm text-gray-600">
                Log in and set up your profile to get started.
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                Log in →
              </Link>
            </>
          ) : profileReady === false ? (
            <>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Finish setting up your profile</h3>
              <p className="mb-4 text-sm text-gray-600">
                Add your industry and tell us who you want to meet - that&rsquo;s what the AI uses to find your matches.
              </p>
              <Link href="/onboarding" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                Complete profile →
              </Link>
            </>
          ) : (
            <>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Your profile is all set 🎉</h3>
              <p className="mb-4 text-sm text-gray-600">
                We&rsquo;re scanning the network for your best connections. New matches appear here
                as more members join - check back soon, or invite people you already refer.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => void load()}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-primary"
                >
                  <Sparkles size={14} /> Refresh matches
                </button>
                <Link href="/dashboard/network/invite" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                  Invite my network →
                </Link>
              </div>
            </>
          )}
        </motion.div>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {visibleSuggestions.map((intro) => {
            const peer =
              intro.sender.id === user?.id ? intro.target : intro.sender;
            const profile = peer.memberProfile;
            const isIncoming = intro.target.id === user?.id && intro.status === 'requested';
            const isSuggested = intro.status === 'suggested' && intro.sender.id === user?.id;
            const isDiscovery = intro.matchFactors?.discovery === 1;

            return (
              <motion.li
                key={intro.id}
                variants={fadeInUp}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary font-bold text-lg">
                      {peer.firstName[0]}
                      {peer.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {peer.firstName} {peer.lastName}
                      </h3>
                      {profile && (
                        <>
                          <p className="text-sm font-medium text-primary">
                            {profile.businessName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {profile.industry}
                            {profile.city ? ` · ${profile.city}, ${profile.state}` : ''}
                          </p>
                          {profile.headline && (
                            <p className="mt-1 text-sm text-gray-600">{profile.headline}</p>
                          )}
                        </>
                      )}
                      <div className="mt-1 flex flex-wrap gap-2">
                      {profile?.videoUrl && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <Video size={12} /> Video intro
                        </span>
                      )}
                      {profile?.openToBarter && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Open to barter
                        </span>
                      )}
                    </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isDiscovery ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <Sparkles size={10} /> You might be interested
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                        <TrendingUp size={10} />
                        {Number(intro.matchScore).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <p className="flex items-start gap-2 text-sm text-blue-900">
                    <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    {intro.reason}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/members?id=${peer.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-primary hover:text-primary"
                  >
                    <ArrowRight size={14} /> View profile
                  </Link>
                  {isSuggested && (
                    <button
                      onClick={() => void requestIntro(intro.id)}
                      disabled={busy === intro.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Handshake size={14} /> Request intro
                    </button>
                  )}
                  {isIncoming && (
                    <>
                      <button
                        onClick={() => void respond(intro.id, 'accept')}
                        disabled={busy === intro.id}
                        className="inline-flex items-center gap-1 rounded-full bg-success px-5 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-60"
                      >
                        <Check size={14} /> Accept intro
                      </button>
                      <button
                        onClick={() => void respond(intro.id, 'decline')}
                        disabled={busy === intro.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <X size={14} /> Decline
                      </button>
                    </>
                  )}
                  {intro.status === 'requested' && intro.sender.id === user?.id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
                      Waiting for response…
                    </span>
                  )}
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
