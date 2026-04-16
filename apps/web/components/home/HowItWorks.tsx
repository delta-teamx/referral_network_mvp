'use client';

import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const STEPS = [
  {
    num: 1,
    title: 'Tell us the moment',
    body: 'Pick one of 14 life events — buying a house, starting a business, planning a wedding. No generic "category" search.',
  },
  {
    num: 2,
    title: 'We match + rank',
    body: 'Our engine scores every nearby pro on trust, distance, conversion history, and category relevance — then shows the top 5–10.',
  },
  {
    num: 3,
    title: 'Connect instantly',
    body: 'One tap notifies the right providers via SMS + email. They reach out to you the same day — or we route to a backup.',
  },
];

export function HowItWorks() {
  return (
    <SectionShell
      eyebrow="How it works"
      title="Three steps from 'I need help' to 'done'"
      subtitle="No lengthy forms. No spam. Real people who specialise in what you're going through."
    >
      <motion.div variants={staggerContainer} className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, idx) => (
          <motion.div
            key={step.num}
            variants={fadeInUp}
            className="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-lg"
          >
            <div className="absolute -top-4 left-8 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#174a6e] text-sm font-bold text-white shadow-lg shadow-primary/30">
              {step.num}
            </div>
            <h3 className="mb-2 mt-2 text-lg font-semibold text-gray-900">{step.title}</h3>
            <p className="text-sm leading-relaxed text-gray-600">{step.body}</p>
            {idx < STEPS.length - 1 && (
              <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-gray-300 md:block">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14m-7-7l7 7-7 7" />
                </svg>
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}
