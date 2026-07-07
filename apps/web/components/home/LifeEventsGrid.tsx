'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { EVENT_TYPE_META } from '@refnet/shared';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';

/**
 * The differentiator. Competitors route by CATEGORY; we route by LIFE EVENT.
 * A realtor is not the same thing to someone buying a house as someone selling one.
 */
export function LifeEventsGrid() {
  const events = Object.values(EVENT_TYPE_META);

  return (
    <SectionShell
      id="life-events"
      eyebrow="Our difference"
      title={
        <>
          Start from <span className="text-primary">what&rsquo;s happening</span>, not a category.
        </>
      }
      subtitle="Pick a life event. We translate it into the right pros and route your lead to the ones most likely to convert - ranked by trust score, distance, and category relevance."
      background="bg-primary-light/40"
    >
      <motion.div
        variants={staggerContainer}
        className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
      >
        {events.map((event) => (
          <motion.div key={event.type} variants={fadeInUp}>
            <Link
              href={`/connect/${event.type.toLowerCase().replace(/_/g, '-')}`}
              className="group block h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary transition group-hover:bg-primary group-hover:text-white">
                <EventIcon icon={event.icon} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{event.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{event.description}</p>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}

/** Minimal inline SVG icons so we don't depend on a library for these. */
function EventIcon({ icon }: { icon: string }) {
  // Emoji fallback keeps this file short; replace with per-event SVG in a later pass.
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
  return <span className="text-lg">{map[icon] ?? '✨'}</span>;
}
