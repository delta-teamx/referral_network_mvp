'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';
import { FoundingOffer } from '../marketing/FoundingOffer';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    subtitle: 'Forever',
    description: 'Get listed, start collecting reviews, join one group.',
    features: ['3 photos', '5 referrals / month', '1 networking group', 'Basic analytics'],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    subtitle: 'per month',
    description: 'Most popular for active pros working the network.',
    features: [
      '15 photos',
      'Unlimited referrals',
      '5 networking groups',
      'Full analytics + trust report',
      'Verified badge',
      '5 life-event leads / month',
    ],
    cta: 'Go Pro',
    highlight: true,
  },
  {
    name: 'Premium',
    price: '$79',
    subtitle: 'per month',
    description: 'For top-ranked pros who want sponsored placement.',
    features: [
      'Unlimited photos',
      'Unlimited everything',
      'Sponsored placement',
      'Priority support',
      'Custom analytics exports',
      'API access',
    ],
    cta: 'Go Premium',
    highlight: false,
  },
];

export function Pricing() {
  return (
    <SectionShell
      eyebrow="Pricing"
      title="Free forever - upgrade when you&rsquo;re ready"
      subtitle="Pay only when the network is earning you business. Cancel anytime."
    >
      <FoundingOffer variant="card" />
      <motion.div variants={staggerContainer} className="grid gap-6 md:grid-cols-3">
        {TIERS.map((t) => (
          <motion.div
            key={t.name}
            variants={fadeInUp}
            className={`relative rounded-2xl border p-7 ${
              t.highlight
                ? 'border-primary bg-primary text-white shadow-2xl shadow-primary/30'
                : 'border-gray-200 bg-white'
            }`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow">
                Most popular
              </span>
            )}
            <h3 className={`text-lg font-semibold ${t.highlight ? 'text-white' : 'text-gray-900'}`}>
              {t.name}
            </h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span
                className={`text-4xl font-bold ${t.highlight ? 'text-white' : 'text-gray-900'}`}
              >
                {t.price}
              </span>
              <span className={`text-sm ${t.highlight ? 'text-white/70' : 'text-gray-500'}`}>
                {t.subtitle}
              </span>
            </div>
            <p className={`mt-2 text-sm ${t.highlight ? 'text-white/80' : 'text-gray-600'}`}>
              {t.description}
            </p>
            <ul className="mt-6 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check
                    size={16}
                    className={`mt-0.5 flex-shrink-0 ${
                      t.highlight ? 'text-secondary' : 'text-success'
                    }`}
                  />
                  <span className={t.highlight ? 'text-white/90' : 'text-gray-700'}>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className={`mt-7 flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                t.highlight
                  ? 'bg-white text-primary hover:bg-white/90'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {t.cta}
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}
