'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Users } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';

type Tab = 'individual' | 'group';

const INDIVIDUAL_PLANS = [
  {
    name: 'Free',
    price: 0,
    desc: 'Try the platform risk-free',
    features: [
      '1 business profile',
      '3 AI introductions per month',
      'Join up to 2 groups',
      'Video profile upload',
      'Book & receive Zoom calls',
      'In-app messaging',
    ],
    cta: 'Start free',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: 49,
    desc: 'For active networkers closing deals',
    features: [
      'Everything in Free',
      '30 AI introductions per month',
      'Up to 3 business profiles',
      'Join up to 10 groups',
      'See full match breakdown',
      'Analytics dashboard',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    href: '/signup',
    featured: true,
  },
  {
    name: 'Premium',
    price: 149,
    desc: 'For power connectors + multi-location businesses',
    features: [
      'Everything in Pro',
      'Unlimited AI introductions',
      'Up to 10 business profiles',
      'Unlimited group memberships',
      'Priority ranking in AI matches',
      'Dedicated account manager',
      'Custom onboarding call',
    ],
    cta: 'Go Premium',
    href: '/signup',
  },
];

const GROUP_PLANS = [
  {
    name: 'Per Seat',
    price: '$10–30',
    unit: '/user/mo',
    desc: 'Pay per active member. Scales with your group.',
    features: [
      'Your own branded instance',
      'Custom logo + colors + welcome message',
      'Admin dashboard (manage members, events, bookings)',
      'AI introductions scoped to YOUR group',
      'Zoom event management from one panel',
      'Per-member analytics + deal tracking',
      'Flexible: add or remove seats anytime',
    ],
  },
  {
    name: 'Flat Rate',
    price: '$99–499',
    unit: '/mo',
    desc: 'Predictable cost regardless of group size.',
    features: [
      'Everything in Per Seat',
      'Unlimited members within your plan tier',
      'Stripe Connect payouts (collect your own membership fees)',
      'Custom domain support (network.yourorg.com)',
      'Priority support + dedicated CSM',
      'Quarterly AI matching report for leadership',
      'Volume discounts for multi-chapter orgs',
    ],
    featured: true,
  },
];

export default function PricingPage() {
  const [tab, setTab] = useState<Tab>('individual');

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-primary-light/20 to-amber-50">
      {/* Hero */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-5xl">
            Simple pricing for members <em className="not-italic text-primary">&</em> organizations
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-gray-600">
            No long-term contracts. No hidden fees. Start free, upgrade when referrals start closing.
          </p>

          {/* Tab switcher */}
          <div className="mx-auto inline-flex rounded-full border border-gray-200 bg-white p-1">
            <button
              onClick={() => setTab('individual')}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                tab === 'individual'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Sparkles size={14} className="mr-1.5 inline" />
              Individual members
            </button>
            <button
              onClick={() => setTab('group')}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                tab === 'group'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users size={14} className="mr-1.5 inline" />
              Groups & organizations
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          {tab === 'individual' ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid gap-6 md:grid-cols-3"
            >
              {INDIVIDUAL_PLANS.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={fadeInUp}
                  className={`relative rounded-3xl border bg-white p-8 shadow-sm ${
                    plan.featured
                      ? 'border-primary shadow-xl ring-2 ring-primary'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-md">
                      <Sparkles size={12} /> Most popular
                    </span>
                  )}
                  <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {plan.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{plan.desc}</p>
                  <ul className="my-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check size={14} className="mt-0.5 flex-shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition ${
                      plan.featured
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'border border-gray-200 text-gray-700 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="grid gap-6 md:grid-cols-2"
            >
              {GROUP_PLANS.map((plan) => (
                <motion.div
                  key={plan.name}
                  variants={fadeInUp}
                  className={`relative rounded-3xl border bg-white p-8 shadow-sm ${
                    plan.featured
                      ? 'border-primary shadow-xl ring-2 ring-primary'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.featured && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-md">
                      Best for larger groups
                    </span>
                  )}
                  <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {plan.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.unit}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{plan.desc}</p>
                  <ul className="my-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check size={14} className="mt-0.5 flex-shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/for-groups#demo"
                    className="block w-full rounded-full bg-gray-900 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Request a demo <ArrowRight size={14} className="ml-1 inline" />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-gray-950 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">
            NRG vs. traditional networking
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-6 py-4 text-left font-medium text-gray-400">Feature</th>
                  <th className="px-6 py-4 text-center font-medium text-primary">VPN</th>
                  <th className="px-6 py-4 text-center font-medium text-gray-400">BNI / Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[
                  ['AI-powered matching', true, false],
                  ['Video intro profiles', true, false],
                  ['Automatic Zoom booking', true, false],
                  ['Outcome tracking (met → deal closed)', true, false],
                  ['White-label for organizations', true, false],
                  ['Barter exchange', true, false],
                  ['Works 24/7 (not just at meetings)', true, false],
                  ['In-person meetings', false, true],
                ].map(([feature, vpn, trad]) => (
                  <tr key={feature as string}>
                    <td className="px-6 py-3 text-gray-300">{feature as string}</td>
                    <td className="px-6 py-3 text-center">
                      {vpn ? (
                        <Check size={16} className="mx-auto text-primary" />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {trad ? (
                        <Check size={16} className="mx-auto text-gray-400" />
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900 md:text-3xl">
            Frequently asked questions
          </h2>
          {[
            { q: 'Can I try it before paying?', a: 'Yes. The Free plan includes 3 AI introductions per month, video profile, booking, and messaging. No credit card required.' },
            { q: 'How does the AI matching actually work?', a: 'Every member fills out a detailed profile: who they serve, who they want to meet, and who they can refer. Our AI scores every possible pair across 7 factors (industry alignment, ICP match, referral compatibility, keywords, location, barter exchange, video transcript) and surfaces the strongest matches.' },
            { q: 'Can my BNI chapter or Chamber use this?', a: 'Absolutely. The Group plan gives you a white-labeled instance with your own branding, admin dashboard, and AI matching scoped to your members. Contact us for a demo.' },
            { q: 'Do I need a Zoom account?', a: 'No. We generate Zoom meeting links automatically when a call is booked. The host and guest both receive the link via email with a calendar invite.' },
            { q: 'Can I cancel anytime?', a: 'Yes. No contracts. Downgrade or cancel from your dashboard at any time.' },
          ].map((faq) => (
            <details key={faq.q} className="group mb-3 rounded-xl border border-gray-200 bg-white">
              <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-gray-900 marker:text-primary">
                {faq.q}
              </summary>
              <p className="px-6 pb-4 text-sm text-gray-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-gray-200 bg-white py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Ready to stop networking the old way?</h2>
          <p className="mb-6 text-gray-600">
            Join 500+ professionals who let AI handle their referrals.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90"
          >
            Create your free profile <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
