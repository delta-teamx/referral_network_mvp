'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, TrendingUp, Users, Zap } from 'lucide-react';
import { fadeInUp, slideInLeft, slideInRight } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const OWNER_FEATURES = [
  {
    icon: Zap,
    title: 'Qualified leads on autopilot',
    body: 'Life-event matching sends you prospects who already need exactly what you do.',
  },
  {
    icon: Users,
    title: 'Build your referral circle',
    body: 'Vetted B2B connections. Give a referral, track the conversion, earn network rank.',
  },
  {
    icon: TrendingUp,
    title: 'Analytics that matter',
    body: 'See where leads come from, which ones convert, and how your trust score moves.',
  },
];

const CONSUMER_FEATURES = [
  {
    title: 'Verified pros only',
    body: 'Real name, real address, real phone. Every listing is manually reviewed.',
  },
  { title: 'Match by moment', body: 'Tell us "I\'m buying a house" - we handle the rest.' },
  {
    title: 'Trust over hype',
    body: 'Our score weighs conversions, not just reviews people write after a freebie.',
  },
  {
    title: 'One tap to connect',
    body: 'No forms. No spam. The right pros reach out to you the same day.',
  },
];

export function ForOwners() {
  return (
    <SectionShell background="bg-gradient-to-b from-white to-gray-50">
      <div className="grid items-start gap-16 md:grid-cols-2">
        <motion.div variants={slideInLeft}>
          <p className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            For business owners
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Stop buying cold leads. Start earning warm ones.
          </h2>
          <p className="mb-8 text-base text-gray-600">
            Thumbtack sells the same lead to 5 competitors. We route leads to the one pro most
            likely to win - based on trust, specialty, and proven conversion.
          </p>
          <div className="space-y-4">
            {OWNER_FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeInUp}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <f.icon size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <Link
            href="/signup?role=BUSINESS_OWNER"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90"
          >
            Claim your business - free →
          </Link>
        </motion.div>

        <motion.div variants={slideInRight}>
          <p className="mb-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            For consumers
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Finally - a way to find a pro without the paid-ad roulette.
          </h2>
          <p className="mb-8 text-base text-gray-600">
            No one should have to vet five strangers on five platforms to hire a plumber. Tell us
            what&rsquo;s happening in your life. We&rsquo;ll match you to the best-fit pros nearby.
          </p>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-4">
              {CONSUMER_FEATURES.map((f) => (
                <motion.li key={f.title} variants={fadeInUp} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{f.title}</p>
                    <p className="text-sm text-gray-600">{f.body}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}
