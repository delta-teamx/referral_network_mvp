'use client';

import { motion } from 'framer-motion';
import { Mail, Share2 } from 'lucide-react';
import { fadeInUp } from '../../lib/animations';
import { SectionShell } from './SectionShell';

export function Invite() {
  return (
    <SectionShell
      eyebrow="Share and grow together"
      title="Your network, multiplied"
      subtitle="Invite a business you trust. When they accept, you both get credited, and your combined trust score lifts."
      background="bg-gray-50"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <motion.div
          variants={fadeInUp}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#174a6e] p-8 text-white transition-transform hover:-translate-y-1"
        >
          <div className="absolute right-4 top-4 opacity-20 transition-opacity group-hover:opacity-40">
            <Mail size={100} />
          </div>
          <h3 className="mb-2 text-xl font-semibold">Invite your network</h3>
          <p className="mb-6 text-sm text-white/80">
            Email, SMS, or shareable link. Track who accepted and who&rsquo;s still thinking.
          </p>
          <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90">
            Get your invite link
          </button>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary to-[#c7701d] p-8 text-white transition-transform hover:-translate-y-1"
        >
          <div className="absolute right-4 top-4 opacity-20 transition-opacity group-hover:opacity-40">
            <Share2 size={100} />
          </div>
          <h3 className="mb-2 text-xl font-semibold">Refer a quality business</h3>
          <p className="mb-6 text-sm text-white/80">
            Spotted a great plumber? Chef? Accountant? Refer them in - earn points, build
            reputation, pay it forward.
          </p>
          <button className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-secondary transition hover:bg-white/90">
            Refer a business
          </button>
        </motion.div>
      </div>
    </SectionShell>
  );
}
