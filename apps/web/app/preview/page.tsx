'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MapPin, Share2, Sparkles, Users, Video } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

const SAMPLE_MATCHES = [
  {
    tier: 'level1',
    score: 91,
    name: 'Maria Chen',
    business: 'Chen Family Insurance',
    industry: 'Commercial insurance',
    location: 'Phoenix, AZ',
    reason:
      'Maria insures roofing contractors and writes 4-5 new policies a month. Your kitchen-remodel clients all need contractor coverage — a clean two-way pipeline.',
  },
  {
    tier: 'level1',
    score: 82,
    name: 'Devon Park',
    business: 'Park Title & Escrow',
    industry: 'Real estate services',
    location: 'Phoenix, AZ',
    reason:
      "Devon closes 30+ residential transactions a month. Every one needs a home inspector — you'd be the first call.",
  },
  {
    tier: 'level2',
    score: 64,
    name: 'Priya Sharma',
    business: 'Sharma Wealth Strategies',
    industry: 'Financial advisory',
    location: 'Scottsdale, AZ',
    reason:
      'Priya works with business owners planning exits. Not a direct fit, but her clients consistently need trusted local services — strong long-term connector.',
  },
  {
    tier: 'level3',
    score: 36,
    name: 'Sam Whitfield',
    business: 'Whitfield Marketing',
    industry: 'B2B marketing',
    location: 'Mesa, AZ',
    reason:
      'Different industry but Sam runs a 200-member founder Slack — even one warm intro from that network can be more valuable than ten cold matches.',
  },
];

const TIER_LABELS: Record<string, { title: string; band: string }> = {
  level1: { title: 'High match', band: '70–100%' },
  level2: { title: 'Potential connector', band: '40–69%' },
  level3: { title: 'Hidden gem', band: 'Below 40%' },
};

const STATS = [
  { value: '30,000+', label: 'Members in the network' },
  { value: '94%', label: 'Intros that lead to a real meeting' },
  { value: '4.8★', label: 'Average member satisfaction' },
];

const TESTIMONIALS = [
  {
    quote:
      'I joined for the referrals. I stayed for the auto-Zoom. I went from sending 5 cold emails a week to having 3 booked calls land on my calendar without lifting a finger.',
    name: 'Jamie L.',
    title: 'Founder, Local HVAC Co.',
  },
  {
    quote:
      "The AI scoring is uncanny. The first match I requested was someone I'd been trying to get introduced to for six months.",
    name: 'Avery R.',
    title: 'Commercial real estate',
  },
];

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function PreviewPage() {
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return makeSessionId();
    const existing = sessionStorage.getItem('nrg.funnel.session');
    if (existing) return existing;
    const fresh = makeSessionId();
    sessionStorage.setItem('nrg.funnel.session', fresh);
    return fresh;
  });

  const signupUrl = useMemo(
    () => `https://nrg.online/join?ref=${encodeURIComponent(sessionId)}`,
    [sessionId],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const referrer = document.referrer || null;
    const campaign = new URLSearchParams(window.location.search).get('utm_campaign');
    void api
      .post('/api/v1/funnel/view', { sessionId, referrer, campaign }, {})
      .catch(() => {
        // Tracking failures are silent — we don't degrade UX for analytics
      });
  }, [sessionId]);

  function logCta(cta: 'join' | 'share' | 'view_match') {
    void api.post('/api/v1/funnel/cta', { sessionId, cta }, {}).catch(() => {});
  }

  async function onShare() {
    logCta('share');
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'See what NRG offers before your first meeting',
          url: window.location.href,
        });
        return;
      } catch {
        // user cancelled
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-white">
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" />
            See it before you join
          </span>
          <h1 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl">
            See what NRG offers before your first meeting.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
            A referral-first network with an AI matching engine. Every member gets curated intros, auto-booked
            Zoom calls, and a weekly digest. Here&apos;s a glimpse of what your dashboard would look like.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={signupUrl}
              onClick={() => logCta('join')}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary/90"
            >
              Ready to join?
              <ArrowRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => void onShare()}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-3 text-base font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Share2 className="h-4 w-4" />
              Share this preview
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-5 text-center shadow-sm">
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-900">Your dashboard, day one.</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          This is the same matching surface every member sees. We score every potential connection and group
          them into three tiers so you know where to focus first.
        </p>

        <div className="mt-8 space-y-8">
          {(['level1', 'level2', 'level3'] as const).map((tier) => {
            const matches = SAMPLE_MATCHES.filter((m) => m.tier === tier);
            return (
              <section key={tier}>
                <header className="mb-3 flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{TIER_LABELS[tier]!.title}</h3>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {TIER_LABELS[tier]!.band}
                  </span>
                </header>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.map((m) => (
                    <article
                      key={m.name}
                      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {m.name
                              .split(' ')
                              .map((w) => w.charAt(0))
                              .join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                            <p className="truncate text-xs text-gray-500">{m.business}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          <Sparkles className="h-3 w-3" />
                          {m.score}%
                        </div>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">{m.industry}</p>
                      <p className="text-xs text-gray-600">{m.reason}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {m.location}
                      </div>
                      <button
                        type="button"
                        onClick={() => logCta('view_match')}
                        className="mt-1 w-full cursor-not-allowed rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-500"
                        title="Sign up to request real intros"
                      >
                        Sign up to request
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-900">What members say</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-base italic text-gray-800">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-4 text-sm text-gray-600">
                — {t.name}, <span className="text-gray-500">{t.title}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-2xl font-bold text-gray-900">Ready to see your real matches?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
            Sign up in under two minutes. Your first 10 curated referrals land on your dashboard before you
            close the browser tab.
          </p>
          <a
            href={signupUrl}
            onClick={() => logCta('join')}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Claim my spot
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
}
