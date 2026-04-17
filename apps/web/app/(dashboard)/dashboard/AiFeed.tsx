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
  } | null;
}

export function AiFeed() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [suggestions, setSuggestions] = useState<IntroSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await api.get<IntroSuggestion[]>('/api/v1/ai/suggestions', {
        accessToken: accessToken ?? undefined,
      });
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
            The AI scans every member&rsquo;s profile — who they serve, who they want to meet, who
            they can refer — and surfaces your best matches. Request an intro and we connect you.
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
            href="/dashboard/network"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Users size={14} /> My network
          </Link>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center"
        >
          <Sparkles size={32} className="mx-auto mb-3 text-primary" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">No suggestions yet</h3>
          <p className="mb-4 text-sm text-gray-600">
            {user
              ? 'Complete your profile so the AI can find your best matches.'
              : 'Log in and set up your profile to get started.'}
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Complete profile →
          </Link>
        </motion.div>
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {suggestions.map((intro) => {
            const peer =
              intro.sender.id === user?.id ? intro.target : intro.sender;
            const profile = peer.memberProfile;
            const isIncoming = intro.target.id === user?.id && intro.status === 'requested';
            const isSuggested = intro.status === 'suggested' && intro.sender.id === user?.id;

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
                      {profile?.videoUrl && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                          <Video size={12} /> Video intro available
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                      <TrendingUp size={10} />
                      {Number(intro.matchScore).toFixed(0)}% match
                    </span>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <p className="flex items-start gap-2 text-sm text-blue-900">
                    <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    {intro.reason}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
