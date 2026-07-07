'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { EVENT_TYPE_META } from '@refnet/shared';
import { fadeInUp, staggerContainer } from '../../../lib/animations';

export default function ConnectLandingPage() {
  const events = Object.values(EVENT_TYPE_META);
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-light/40 to-white px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="mb-10 text-center"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            Life events connector
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            What&rsquo;s happening in your life?
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Pick the closest moment. We&rsquo;ll translate it into the right pros and route you to
            the top 5-10 nearby - ranked by trust score, not ad spend.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
        >
          {events.map((event) => (
            <motion.div key={event.type} variants={fadeInUp}>
              <Link
                href={`/connect/${event.type.toLowerCase().replace(/_/g, '-')}`}
                className="group block h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-xl transition group-hover:bg-primary group-hover:text-white">
                  <EmojiFor icon={event.icon} />
                </div>
                <p className="font-semibold text-gray-900">{event.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{event.description}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}

function EmojiFor({ icon }: { icon: string }) {
  const map: Record<string, string> = {
    home: '🏠',
    'home-sold': '🏡',
    rings: '💍',
    briefcase: '💼',
    baby: '👶',
    candle: '🕯️',
    hammer: '🔨',
    tree: '🌳',
    truck: '🚚',
    party: '🎉',
    graduation: '🎓',
    gavel: '⚖️',
    chef: '👨‍🍳',
    flag: '🚩',
  };
  return <span>{map[icon] ?? '✨'}</span>;
}
