'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  Video,
  Target,
  CalendarCheck,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Handshake,
  ListChecks,
  ArrowLeftRight,
  LayoutDashboard,
  Zap,
  Check,
  Sparkles,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const benefits = [
  {
    icon: Brain,
    title: 'AI-Powered Matching',
    description: 'Our 7-factor engine finds the people most likely to send you qualified referrals — automatically, every day.',
  },
  {
    icon: Video,
    title: '60-Second Video Intro',
    description: 'Put a face to your name. Members with videos get 3x more intro requests than text-only profiles.',
  },
  {
    icon: Target,
    title: 'Ideal Client Targeting',
    description: 'Define exactly who you serve and let the AI connect you with members who serve that same audience.',
  },
  {
    icon: CalendarCheck,
    title: 'Built-In Scheduling',
    description: 'Book Zoom calls directly inside the platform. No back-and-forth emails, no third-party links.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust Score & Reviews',
    description: 'Every member earns a transparent trust score based on activity, referrals given, and peer reviews.',
  },
  {
    icon: TrendingUp,
    title: 'Outcome Analytics',
    description: 'Track referrals sent, received, and converted. See exactly which connections drive revenue.',
  },
];

const profileFeatures = [
  { icon: Video, label: '60-second video pitch' },
  { icon: Target, label: 'Ideal Client Profile (ICP)' },
  { icon: ListChecks, label: 'Services & specialties list' },
  { icon: ArrowLeftRight, label: 'Barter / trade preferences' },
  { icon: Handshake, label: 'Referral history & stats' },
  { icon: ShieldCheck, label: 'Trust score badge' },
];

const feedFeatures = [
  'Daily curated match suggestions ranked by fit score',
  'Filter by industry, location, or referral potential',
  'One-click intro request with personal note',
  'Save matches for later or dismiss with feedback',
  'AI learns your preferences over time for better results',
];

const comparisonRows = [
  { feature: 'Matching method', vpn: 'AI-powered 7-factor engine', traditional: 'Manual introductions or random pairings' },
  { feature: 'Time commitment', vpn: '15 min / week reviewing matches', traditional: '2-4 hours / week at in-person meetings' },
  { feature: 'Geographic reach', vpn: 'Nationwide (or global)', traditional: 'Limited to local chapter' },
  { feature: 'Cost', vpn: 'Free plan available; Pro from $49/mo', traditional: '$500-$2,000+ / year plus meal costs' },
  { feature: 'Scheduling', vpn: 'Built-in Zoom booking', traditional: 'DIY email back-and-forth' },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    features: ['1 listing', '3 leads / month', '2 group memberships', 'Trust score', 'Basic matching'],
    cta: 'Start free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    features: ['3 listings', '30 leads / month', '10 group memberships', 'Ranking breakdown', 'Verified badge'],
    cta: 'Go Pro',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: '$149',
    period: '/month',
    features: ['10 listings', 'Unlimited leads', 'Unlimited groups', 'Priority placement', 'Account manager'],
    cta: 'Go Premium',
    highlighted: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ForMembersPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ---- Hero ---- */}
      <section className="bg-gradient-to-br from-white via-primary-light/30 to-amber-50 px-6 py-24 text-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            For Members
          </motion.p>
          <motion.h1 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Built for business owners who are tired of networking the old way
          </motion.h1>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            No more rubber-chicken dinners. No more swapping cards with people who will never refer you.
            VirtualProsNetwork uses AI to connect you with the right partners — fast.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-8">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
            >
              Create your free profile
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ---- What You Get ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Membership Benefits
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            What you get as a member
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 max-w-2xl text-gray-600">
            Everything you need to find, connect with, and convert high-quality referral partners — all in one platform.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{b.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- Profile as Salesperson ---- */}
      <section className="bg-gray-50 px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-6xl"
        >
          <div className="flex flex-col items-center gap-12 md:flex-row">
            {/* Text */}
            <div className="flex-1">
              <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
                Your Profile
              </motion.p>
              <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
                Your profile is your 24/7 salesperson
              </motion.h2>
              <motion.p variants={fadeInUp} className="mt-4 text-gray-600 leading-relaxed">
                While you sleep, your VirtualProsNetwork profile is working. It tells the AI what you do, who you
                serve, and what makes you different. Other members discover you through the match feed and can
                request an intro with a single click.
              </motion.p>
            </div>

            {/* Visual card */}
            <motion.div variants={fadeInUp} className="flex-1">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">What your profile includes</p>
                    <p className="text-xs text-gray-500">Visible to verified members</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {profileFeatures.map((pf) => {
                    const Icon = pf.icon;
                    return (
                      <li key={pf.label} className="flex items-center gap-3 text-sm text-gray-700">
                        <Icon size={16} className="flex-shrink-0 text-primary" />
                        {pf.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ---- Referral Feed ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="flex flex-col items-center gap-12 md:flex-row-reverse">
            <div className="flex-1">
              <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
                AI Suggestions
              </motion.p>
              <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
                The referral feed
              </motion.h2>
              <motion.p variants={fadeInUp} className="mt-4 text-gray-600 leading-relaxed">
                Think of it as a social feed, but every card is a vetted business owner the AI believes can either
                send you referrals or receive them. Swipe through your daily matches, request intros, and watch
                your pipeline grow.
              </motion.p>
            </div>

            <motion.div variants={fadeInUp} className="flex-1">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-primary" />
                  <p className="text-sm font-semibold text-gray-900">Your daily match dashboard</p>
                </div>
                <ul className="space-y-3">
                  {feedFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Zap size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ---- Book Calls ---- */}
      <section className="bg-gray-50 px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-4xl text-center"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Scheduling
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Book calls directly
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-gray-600">
            Stop copying Calendly links and juggling time zones. VirtualProsNetwork integrates with your calendar
            and generates a Zoom meeting in one click. Accept an intro, pick a time, and show up.
          </motion.p>
          <motion.div variants={fadeInUp} className="mx-auto mt-10 grid max-w-2xl gap-6 sm:grid-cols-3">
            {[
              { icon: CalendarCheck, label: 'Calendar sync' },
              { icon: Video, label: 'Auto Zoom link' },
              { icon: TrendingUp, label: 'Outcome logging' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-center"
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon size={24} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- Comparison Table ---- */}
      <section className="bg-gray-950 px-6 py-20 text-white">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-4xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Why Switch
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold md:text-4xl">
            VirtualProsNetwork vs. Traditional networking groups
          </motion.h2>

          <motion.div variants={fadeInUp} className="mt-10 overflow-hidden rounded-2xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900">
                  <th className="px-6 py-4 font-semibold text-gray-400">Feature</th>
                  <th className="px-6 py-4 font-semibold text-primary">VirtualProsNetwork</th>
                  <th className="px-6 py-4 font-semibold text-gray-400">Traditional Groups</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={i < comparisonRows.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-6 py-4 font-medium text-gray-300">{row.feature}</td>
                    <td className="px-6 py-4 text-gray-200">{row.vpn}</td>
                    <td className="px-6 py-4 text-gray-500">{row.traditional}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </motion.div>
      </section>

      {/* ---- Pricing Preview ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p variants={fadeInUp} className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            Simple, transparent pricing
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            Start free. Upgrade when you are ready for more matches, more listings, and deeper analytics.
          </motion.p>

          <motion.div variants={staggerContainer} className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeInUp}
                className={`relative rounded-2xl border bg-white p-8 shadow-sm ${
                  plan.highlighted ? 'border-primary shadow-xl ring-2 ring-primary' : 'border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-md">
                    <Sparkles size={12} /> Most popular
                  </span>
                )}
                <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{plan.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
                <ul className="my-6 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check size={14} className="mt-0.5 flex-shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`block w-full rounded-full py-2.5 text-center text-sm font-semibold transition ${
                    plan.highlighted
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-6 text-center text-sm text-gray-500">
            <Link href="/pricing" className="text-primary underline hover:text-primary/80">
              See full plan comparison
            </Link>
          </motion.p>
        </motion.div>
      </section>

      {/* ---- CTA ---- */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-amber-50 px-6 py-20 text-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto max-w-2xl"
        >
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold text-gray-900 md:text-4xl">
            Create your free profile
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-gray-600">
            It takes less than 5 minutes. No credit card required. Start getting AI-matched referral partners today.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-8">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
            >
              Create your free profile
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
