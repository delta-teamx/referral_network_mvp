'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Brain,
  Check,
  Crown,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { APP_BASE_URL } from '../../../lib/domains';

/*
 * Co-branded NRG x Referral Nova partner landing page.
 *
 * This is the PERMANENT tracking link the NRG team announces
 * (referralnova.com/nrg). The time-boxed 48-hour join link is minted
 * separately by a group leader from the group manager and shared by NRG.
 *
 * BRANDING IS PLACEHOLDER. Swap NRG_BRAND below for the real assets from
 * Lori/Brian at launch:
 *   - logoUrl: NRG logo (transparent PNG/SVG). Leave null to show the text mark.
 *   - color:   NRG primary hex.
 *   - name / tagline / blurb: final approved copy.
 */
const NRG_BRAND = {
  name: 'NRG',
  fullName: 'Network Referral Group',
  slogan: 'Energy for Business',
  // Drop the hosted NRG logo URL here to show the real mark instead of the
  // styled "NRG" text lockup (a leader can also upload it in the group manager).
  logoUrl: null as string | null,
  color: '#F5821F', // NRG orange
  colorAccent: '#FDB515', // NRG amber/gold
  tagline: 'Network Referral Group, powered by Referral Nova',
  blurb:
    'NRG is partnering with Referral Nova to give members a private, AI-powered referral network built around live Zoom events - with lifetime Premium access included.',
};

// Permanent tracking params so signups from this page are attributable.
const TRACK = 'utm_source=nrg&utm_medium=partner&utm_campaign=nrg-launch';

const benefits = [
  {
    icon: Crown,
    title: 'Lifetime Premium access',
    description:
      'Every NRG launch member gets Referral Nova Premium for life - all AI matching, unlimited intros, bookings and analytics, at no monthly cost.',
  },
  {
    icon: Brain,
    title: 'AI-powered referrals',
    description:
      'Our 7-factor matching engine surfaces the right introductions inside the NRG community, so every connection is relevant.',
  },
  {
    icon: Lock,
    title: 'A private community',
    description:
      'The NRG group is closed. The member list, events and chat are visible only to approved members - your network stays yours.',
  },
  {
    icon: Users,
    title: 'Run by NRG leaders',
    description:
      'NRG group admins approve new members and keep the community high-trust, while Referral Nova handles the technology.',
  },
];

const steps = [
  {
    n: '1',
    title: 'NRG shares the launch link',
    body: 'The NRG team announces the collaboration and shares a single invite link. It is live for 48 hours.',
  },
  {
    n: '2',
    title: 'Join and unlock lifetime Premium',
    body: 'Anyone who joins through that link during the window is added to the NRG group automatically and gets lifetime Premium.',
  },
  {
    n: '3',
    title: 'Missed the window? Request to join',
    body: 'Already a member or joined later? Request to join the group. An NRG admin approves you, and we email you the moment you are in.',
  },
  {
    n: '4',
    title: 'NRG onboards new members',
    body: 'If you are new to NRG, the NRG team reaches out directly to complete membership and onboarding.',
  },
];

export default function NrgLandingPage() {
  return (
    <main className="bg-white">
      {/* Hero */}
      <section
        className="relative overflow-hidden px-6 py-20 sm:py-28"
        style={{
          background: `linear-gradient(135deg, ${NRG_BRAND.color}14 0%, #ffffff 55%, #EFF6FF 100%)`,
        }}
      >
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl text-center"
        >
          {/* Co-branded lockup (placeholder logos) */}
          <motion.div variants={fadeInUp} className="mb-8 flex items-center justify-center gap-4">
            {NRG_BRAND.logoUrl ? (
              <span className="flex h-14 items-center rounded-2xl bg-white px-4 shadow-sm ring-1 ring-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={NRG_BRAND.logoUrl} alt={NRG_BRAND.fullName} className="h-10" />
              </span>
            ) : (
              <span
                className="flex h-14 flex-col items-center justify-center rounded-2xl px-5 text-white shadow-sm"
                style={{
                  background: `linear-gradient(180deg, ${NRG_BRAND.color} 0%, ${NRG_BRAND.colorAccent} 100%)`,
                }}
              >
                <span className="text-xl font-black leading-none tracking-tight">{NRG_BRAND.name}</span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-white/90">
                  {NRG_BRAND.slogan}
                </span>
              </span>
            )}
            <span className="text-2xl font-light text-gray-300">×</span>
            <span className="flex h-14 items-center rounded-2xl bg-primary px-5 text-xl font-black tracking-tight text-white shadow-sm">
              Referral Nova
            </span>
          </motion.div>

          <motion.p
            variants={fadeInUp}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600 ring-1 ring-gray-200"
          >
            <Sparkles size={13} /> Official partnership
          </motion.p>

          <motion.h1
            variants={fadeInUp}
            className="mt-5 text-4xl font-black leading-tight text-gray-900 sm:text-5xl"
          >
            {NRG_BRAND.tagline}
          </motion.h1>
          <motion.p variants={fadeInUp} className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
            {NRG_BRAND.blurb}
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`${APP_BASE_URL}/signup?${TRACK}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            >
              Get started <ArrowRight size={16} />
            </Link>
            <Link
              href={`${APP_BASE_URL}/dashboard/groups`}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-7 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Already a member? Request to join
            </Link>
          </motion.div>
          <motion.p variants={fadeInUp} className="mt-4 text-xs text-gray-500">
            The official 48-hour invite link is shared directly by the NRG team.
          </motion.p>
        </motion.div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">What NRG members get</h2>
            <p className="mt-3 text-gray-600">
              A dedicated home for NRG referrals, with the full Referral Nova toolkit behind it.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: NRG_BRAND.color }}
                >
                  <b.icon size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{b.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">How to join</h2>
            <p className="mt-3 text-gray-600">Four simple steps from the NRG announcement to being in.</p>
          </div>
          <ol className="space-y-5">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: NRG_BRAND.color }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div
          className="mx-auto max-w-3xl rounded-3xl px-8 py-14 text-center text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${NRG_BRAND.color} 0%, ${NRG_BRAND.colorAccent} 100%)`,
          }}
        >
          <h2 className="text-3xl font-bold">Join the NRG referral network</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Create your Referral Nova account, then use the NRG invite link to unlock lifetime
            Premium and join the community.
          </p>
          <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2 text-left text-sm">
            {['Lifetime Premium access', 'AI-matched referrals', 'A private, approved community'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check size={16} className="text-white" /> {t}
              </li>
            ))}
          </ul>
          <Link
            href={`${APP_BASE_URL}/signup?${TRACK}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
          >
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
