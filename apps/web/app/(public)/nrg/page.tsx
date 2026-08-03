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
 * Co-branded NRG x Referral Nova partner landing page (referralnova.com/nrg) -
 * the permanent link the NRG team announces. The 48-hour join link is minted
 * separately by a group leader and shared by NRG.
 */
const NRG_BRAND = {
  name: 'NRG',
  fullName: 'Network Referral Group',
  slogan: 'Energy for Business',
  logoUrl: '/nrg-logo.png' as string | null,
  color: '#F5821F', // NRG orange
  colorAccent: '#FDB515', // NRG amber/gold
  tagline: 'A strategic partnership to transform business growth through AI and referral innovation',
  blurb:
    'Network Referral Group and Virtual Pros have partnered to give NRG members access to Referral Nova - an AI-powered referral platform built to strengthen the trusted relationships NRG members have spent years building, and create new opportunities for collaboration and growth.',
};

// Press-release "what members can expect" points.
const expectations = [
  'Access to innovative AI-powered business growth technologies from Virtual Pros.',
  'Exclusive opportunities to participate in the Referral Nova ecosystem.',
  'Enhanced referral connections through intelligent business matching.',
  'Educational resources, presentations, and training on practical AI strategies for business growth.',
  'Continued collaboration between NRG and Virtual Pros to bring new value-added services to the membership.',
];

const quotes = [
  {
    quote:
      "We're excited to partner with NRG because both organizations share the same mission: helping businesses succeed through meaningful relationships. Our goal is to equip NRG members with innovative AI technology that strengthens the value of their existing network while creating new opportunities for collaboration and growth.",
    name: 'Brian Parnell',
    title: 'Founder, Virtual Pros',
  },
  {
    quote:
      "This partnership reflects NRG's ongoing commitment to providing members with innovative resources that help them build stronger businesses and create more referral opportunities.",
    name: 'Mike Weiner',
    title: 'CEO, Network Referral Group',
  },
];

const abouts = [
  {
    name: 'Virtual Pros',
    body: 'Virtual Pros is an AI-powered business growth company that helps organizations increase revenue through intelligent automation, AI-powered business solutions, marketing systems, and strategic growth technologies. By combining cutting-edge artificial intelligence with practical business expertise, Virtual Pros empowers companies to save time, improve customer engagement, and scale more effectively.',
  },
  {
    name: 'Referral Nova',
    body: 'Referral Nova is an AI-powered referral platform and strategic partner of Virtual Pros. Designed specifically for business professionals, Referral Nova helps members create meaningful business connections through intelligent referral matching, relationship building, and collaborative networking.',
  },
  {
    name: 'Network Referral Group (NRG)',
    body: 'Network Referral Group (NRG) is a professional business networking organization dedicated to helping its members grow through trusted relationships, referrals, education, and collaboration. NRG provides entrepreneurs and professionals with opportunities to connect, learn, and build long-term business success.',
  },
];

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
              <span className="flex h-16 items-center rounded-2xl bg-white px-4 shadow-sm ring-1 ring-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={NRG_BRAND.logoUrl}
                  alt="NRG - Network Referral Group - Energy for Business"
                  className="h-12 w-auto"
                />
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

      {/* Announcement / press release */}
      <section className="border-t border-gray-100 bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            For immediate release
          </p>
          <h2 className="mt-2 text-3xl font-bold leading-tight text-gray-900">
            NRG and Virtual Pros announce strategic partnership to transform business growth through
            AI and referral innovation
          </h2>
          <p className="mt-4 text-sm font-medium text-gray-500">Gettysburg, PA — August 2, 2026</p>

          <div className="mt-6 space-y-4 text-gray-700">
            <p>
              Virtual Pros, a leader in AI-powered business growth and automation solutions, is proud
              to announce a new strategic partnership with Network Referral Group (NRG), creating
              exciting new opportunities for NRG members to accelerate business growth through
              artificial intelligence, strategic networking, and referral innovation.
            </p>
            <p>
              As part of this partnership, NRG members will gain access to exclusive technologies and
              resources developed by Virtual Pros, including <strong>Referral Nova</strong>, Virtual
              Pros&rsquo; AI-powered referral platform designed to help professionals build stronger
              business relationships and generate more qualified referral opportunities.
            </p>
            <p>
              Unlike traditional social networking platforms, Referral Nova focuses on connecting the
              right people at the right time through intelligent matching and proactive referral
              opportunities. The platform is designed to complement&mdash;not replace&mdash;the
              trusted relationships and networking that NRG members have built over the years.
            </p>
          </div>

          {/* Quotes */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {quotes.map((q) => (
              <blockquote
                key={q.name}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-6"
                style={{ borderLeft: `3px solid ${NRG_BRAND.color}` }}
              >
                <p className="text-sm italic text-gray-700">&ldquo;{q.quote}&rdquo;</p>
                <footer className="mt-3 text-sm">
                  <span className="font-semibold text-gray-900">{q.name}</span>
                  <span className="text-gray-500"> — {q.title}</span>
                </footer>
              </blockquote>
            ))}
          </div>

          {/* What members can expect */}
          <h3 className="mt-10 text-xl font-bold text-gray-900">
            Through this partnership, NRG members can expect
          </h3>
          <ul className="mt-4 space-y-3">
            {expectations.map((e) => (
              <li key={e} className="flex items-start gap-3 text-gray-700">
                <Check size={18} className="mt-0.5 shrink-0" style={{ color: NRG_BRAND.color }} />
                <span>{e}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-gray-700">
            The organizations will work together on educational initiatives, member engagement,
            strategic events, and the continued evolution of AI-driven networking solutions designed
            specifically for business professionals &mdash; the beginning of a long-term
            collaboration focused on helping entrepreneurs, business owners, and professionals thrive
            in an increasingly connected, technology-driven marketplace.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-gray-100 px-6 py-20">
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

      {/* About the organizations */}
      <section className="border-t border-gray-100 bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-gray-900">About the partners</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {abouts.map((a) => (
              <div key={a.name} className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-bold text-gray-900">{a.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{a.body}</p>
              </div>
            ))}
          </div>
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
