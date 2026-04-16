'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Church, HandHeart, Heart, Shield } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const CAUSES = [
  {
    icon: HandHeart,
    title: 'Donate your labor',
    body: 'Offer a few hours of your trade to a neighbor who needs it. Verified hours count toward your trust score.',
    cta: 'See open requests',
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    icon: Church,
    title: 'Support your church',
    body: 'Churches can list service needs — roofing, landscaping, tech — and members pitch in.',
    cta: 'Register a church',
    accent: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    icon: Shield,
    title: 'Support veterans',
    body: 'Free or discounted services for veterans and first-responders. Verified via ID.me.',
    cta: 'Join the program',
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
  },
];

export function Community() {
  return (
    <SectionShell
      eyebrow="Help your community"
      title={
        <>
          The referral network
          <br />
          <span className="text-success">that gives back.</span>
        </>
      }
      subtitle="Every member can pledge hours or services to neighbors, churches, and veterans. We track it transparently and credit it to your network rank."
      background="bg-white"
    >
      <motion.div variants={staggerContainer} className="grid gap-5 md:grid-cols-3">
        {CAUSES.map((c) => (
          <motion.div
            key={c.title}
            variants={fadeInUp}
            className={`group rounded-2xl border p-7 transition-all hover:-translate-y-1 hover:shadow-lg ${c.accent}`}
          >
            <c.icon size={28} className="mb-4" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">{c.title}</h3>
            <p className="mb-5 text-sm leading-relaxed text-gray-700">{c.body}</p>
            <button className="inline-flex items-center gap-2 text-sm font-semibold">
              {c.cta} →
            </button>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={fadeInUp}
        className="mt-12 flex flex-wrap items-center justify-center gap-6 rounded-2xl border-2 border-dashed border-success/40 bg-success/5 p-8 text-center"
      >
        <div className="flex items-center gap-3 text-success">
          <Heart size={24} className="fill-success" />
          <p className="text-lg font-semibold">
            1,420 hours pledged · $89,000 in donated services · 2025
          </p>
        </div>
        <Link
          href="/donate-labor"
          className="inline-flex items-center gap-2 rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-success/90"
        >
          Add yours →
        </Link>
      </motion.div>
    </SectionShell>
  );
}
