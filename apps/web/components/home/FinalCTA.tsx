'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../lib/animations';
import { SectionShell } from './SectionShell';

export function FinalCTA() {
  return (
    <SectionShell background="bg-gray-900">
      <motion.div variants={fadeInUp} className="text-center text-white">
        <h2 className="mb-5 text-3xl font-bold md:text-5xl">Ready to join?</h2>
        <p className="mx-auto mb-10 max-w-2xl text-base text-gray-300 md:text-lg">
          2,400+ local pros are already in. Free to list, free to get matched, free to exchange
          referrals. Upgrade only when you&rsquo;re earning.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-secondary px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-secondary/30 transition hover:bg-secondary/90"
          >
            Create your free account
          </Link>
          <Link
            href="#search"
            className="rounded-full border border-white/30 px-8 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Find a pro first
          </Link>
        </div>
      </motion.div>
    </SectionShell>
  );
}
