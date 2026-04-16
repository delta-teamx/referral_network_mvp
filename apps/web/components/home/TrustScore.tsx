'use client';

import { motion } from 'framer-motion';
import { fadeInUp } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const FACTORS = [
  { label: 'Verified identity', weight: 15 },
  { label: 'Reviews (weighted)', weight: 25 },
  { label: 'Referrals converted', weight: 20 },
  { label: 'Response time', weight: 10 },
  { label: 'Years active', weight: 10 },
  { label: 'Network endorsements', weight: 20 },
];

export function TrustScore() {
  return (
    <SectionShell
      eyebrow="Our secret sauce"
      title="Trust score — stars don't tell the whole story"
      subtitle="Every business has a score from 0 to 10, updated nightly. It's how we rank, match, and route. Transparent factors, no pay-to-win."
      background="bg-gradient-to-b from-primary-light/30 to-white"
    >
      <div className="grid items-center gap-10 md:grid-cols-2">
        <motion.div variants={fadeInUp} className="flex justify-center">
          <TrustGauge value={9.2} />
        </motion.div>

        <motion.div variants={fadeInUp}>
          <h3 className="mb-5 text-lg font-semibold text-gray-900">What goes into the score</h3>
          <div className="space-y-3">
            {FACTORS.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{f.label}</span>
                  <span className="font-semibold text-gray-900">{f.weight}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(f.weight / 25) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </SectionShell>
  );
}

function TrustGauge({ value }: { value: number }) {
  const pct = Math.min(Math.max(value / 10, 0), 1);
  const circumference = 2 * Math.PI * 80;
  const offset = circumference * (1 - pct * 0.75);
  return (
    <div className="relative h-60 w-60">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-[135deg]">
        <circle
          cx="100"
          cy="100"
          r="80"
          stroke="#E5E7EB"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
        />
        <motion.circle
          cx="100"
          cy="100"
          r="80"
          stroke="url(#trust-gradient)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="trust-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1B5E8C" />
            <stop offset="100%" stopColor="#E8913A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Trust</p>
        <p className="text-5xl font-bold text-gray-900">{value.toFixed(1)}</p>
        <p className="text-sm text-gray-500">out of 10</p>
      </div>
    </div>
  );
}
