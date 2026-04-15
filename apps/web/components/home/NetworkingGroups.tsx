'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, MapPin, Repeat } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';

const GROUPS = [
  {
    icon: BookOpen,
    name: 'Study Groups',
    description:
      'Weekly peer-learning cohorts. Share case studies, work through challenges, level up together.',
    accent: 'bg-blue-50 text-blue-700',
    stat: '47 active',
  },
  {
    icon: MapPin,
    name: 'Local Chapters',
    description:
      'In-person meetups organised by city. Coffee, happy hours, and structured referral swaps.',
    accent: 'bg-emerald-50 text-emerald-700',
    stat: '22 cities',
  },
  {
    icon: Repeat,
    name: 'Referral Groups',
    description:
      'BNI-style accountability — commit to exchanging N referrals/month, track who earned what.',
    accent: 'bg-violet-50 text-violet-700',
    stat: '310 groups',
  },
];

export function NetworkingGroups() {
  return (
    <SectionShell
      eyebrow="Your network"
      title="Join a group — or start your own"
      subtitle="Three flavours, one goal: turn loose connections into durable business relationships."
      background="bg-gray-50"
    >
      <motion.div variants={staggerContainer} className="grid gap-6 md:grid-cols-3">
        {GROUPS.map((g) => (
          <motion.div
            key={g.name}
            variants={fadeInUp}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div
              className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${g.accent}`}
            >
              <g.icon size={22} />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {g.stat}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{g.description}</p>
            <Link
              href="/groups"
              className="mt-5 inline-flex text-sm font-semibold text-primary transition group-hover:gap-2"
            >
              Browse {g.name.toLowerCase()} →
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}
