'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeInUp, slideInLeft, slideInRight } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const BENEFITS = [
  'Real leads matched by life event - not category spam',
  'Trust score makes quality transparent from the first click',
  'Exchange referrals inside vetted groups, track who earned what',
  'Every interaction strengthens (or weakens) your network rank',
  'Free to join, free to list, pay only when you want boost',
];

export function WhyJoin() {
  return (
    <SectionShell background="bg-white">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <motion.div variants={slideInLeft}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            Why join the network
          </p>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Built for pros who care <span className="text-primary">who&rsquo;s</span> sending them
            business.
          </h2>
          <p className="mb-7 text-base text-gray-600 md:text-lg">
            The old referral world is a Rolodex - you know the names but not the quality. We measure
            both, in public, and reward the pros who show up consistently.
          </p>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <motion.li
                key={b}
                variants={fadeInUp}
                className="flex items-start gap-3 text-sm text-gray-700"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span>{b}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div variants={slideInRight} className="grid grid-cols-2 gap-4">
          <StatCard
            value="2,400+"
            label="Verified businesses"
            delta="+184 this month"
            accent="bg-primary-light text-primary"
          />
          <StatCard
            value="91%"
            label="Lead conversion"
            delta="vs. 34% on Thumbtack"
            accent="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            value="4.8/10"
            label="Median trust score"
            delta="Across active members"
            accent="bg-amber-50 text-amber-700"
          />
          <StatCard
            value="$3.2M"
            label="Referred in 2025"
            delta="+72% YoY"
            accent="bg-rose-50 text-rose-700"
          />
        </motion.div>
      </div>
    </SectionShell>
  );
}

function StatCard({
  value,
  label,
  delta,
  accent,
}: {
  value: string;
  label: string;
  delta: string;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl p-6 ${accent}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-3 text-xs opacity-80">{delta}</p>
    </div>
  );
}
