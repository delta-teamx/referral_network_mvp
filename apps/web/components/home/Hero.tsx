'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';

/**
 * Hero — animated gradient mesh background, dual CTAs, live trust-proof
 * counters. The visual differentiator vs. the competitor's static hero.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[#174a6e] to-[#0d3650] px-6 pt-20 pb-28 text-white md:pt-28 md:pb-36">
      {/* Animated mesh blobs */}
      <motion.div
        aria-hidden
        className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-secondary/30 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -left-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl"
        animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative mx-auto max-w-5xl text-center"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={fadeInUp}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur"
        >
          <Sparkles size={14} className="text-secondary" />A new kind of referral network — built
          around life&rsquo;s moments
        </motion.div>

        <motion.h1
          variants={fadeInUp}
          className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
        >
          Find trusted local pros
          <br />
          <span className="bg-gradient-to-r from-secondary via-[#ffb066] to-white bg-clip-text text-transparent">
            for life&rsquo;s biggest moments.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeInUp}
          className="mx-auto mb-10 max-w-2xl text-lg text-white/80 md:text-xl"
        >
          Buying a house, starting a business, planning a wedding? Pick what&rsquo;s happening in
          your life — we match you with verified pros who specialise in exactly that, backed by a
          trust score, not just star ratings.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="#search"
            className="group inline-flex items-center gap-2 rounded-full bg-secondary px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-secondary/30 transition hover:bg-secondary/90"
          >
            <Search size={18} />
            Find a pro near me
            <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            List your business — free
          </Link>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-white/70"
        >
          <TrustStat value="2,400+" label="Verified businesses" />
          <TrustStat value="14" label="Life-event matches" />
          <TrustStat value="$3.2M" label="Referred business in 2025" />
          <TrustStat value="4.8" label="Avg. trust score" suffix="/10" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function TrustStat({ value, label, suffix }: { value: string; label: string; suffix?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-white">
        {value}
        {suffix && <span className="text-white/60">{suffix}</span>}
      </span>
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
  );
}
