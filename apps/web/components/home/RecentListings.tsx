'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, Star } from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../lib/animations';
import { SectionShell } from './SectionShell';

/**
 * Mock listings preview — swapped for a live `/api/v1/listings/recent` feed
 * once Branch 3 directory ships. Intentionally generated, not "empty", so
 * the homepage never looks broken.
 */
const MOCK_LISTINGS = [
  {
    id: '1',
    slug: 'johnson-realty',
    name: 'Johnson Realty',
    shortDescription: 'Full-service residential realtor in St. Louis metro. 12 years, 400+ homes.',
    category: 'Realtor',
    city: 'St. Louis',
    state: 'MO',
    trustScore: 9.4,
    avgRating: 4.9,
    reviewCount: 182,
    verified: true,
    accent: 'from-blue-500 to-primary',
  },
  {
    id: '2',
    slug: 'nguyen-accounting',
    name: 'Nguyen Accounting & Tax',
    shortDescription: 'Small-business CPA. S-corps, LLC formation, quarterly taxes done right.',
    category: 'Accountant',
    city: 'Clayton',
    state: 'MO',
    trustScore: 9.1,
    avgRating: 4.8,
    reviewCount: 94,
    verified: true,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    id: '3',
    slug: 'bloomhouse-florals',
    name: 'Bloomhouse Florals',
    shortDescription: 'Weddings, events, sympathy. Same-day delivery across the metro area.',
    category: 'Florist',
    city: 'Kirkwood',
    state: 'MO',
    trustScore: 8.7,
    avgRating: 4.7,
    reviewCount: 56,
    verified: false,
    accent: 'from-pink-500 to-rose-500',
  },
  {
    id: '4',
    slug: 'cap-city-electric',
    name: 'Cap City Electric',
    shortDescription: 'Licensed residential + commercial electricians. 24/7 emergency calls.',
    category: 'Electrician',
    city: 'Ballwin',
    state: 'MO',
    trustScore: 8.9,
    avgRating: 4.9,
    reviewCount: 213,
    verified: true,
    accent: 'from-amber-500 to-orange-500',
  },
  {
    id: '5',
    slug: 'reed-family-law',
    name: 'Reed Family Law',
    shortDescription: 'Divorce, custody, estate planning. Compassionate, fixed-fee where possible.',
    category: 'Lawyer',
    city: 'St. Louis',
    state: 'MO',
    trustScore: 9.2,
    avgRating: 4.8,
    reviewCount: 71,
    verified: true,
    accent: 'from-indigo-500 to-violet-600',
  },
  {
    id: '6',
    slug: 'harvest-table-catering',
    name: 'Harvest Table Catering',
    shortDescription: 'Seasonal farm-to-table catering for 20–500 guests. Dietary-friendly menus.',
    category: 'Caterer',
    city: 'Webster Groves',
    state: 'MO',
    trustScore: 8.5,
    avgRating: 4.7,
    reviewCount: 132,
    verified: true,
    accent: 'from-green-500 to-emerald-600',
  },
];

export function RecentListings() {
  return (
    <SectionShell
      eyebrow="Recently added"
      title="Fresh businesses joining the network"
      subtitle="Every listing is verified. Every business owner has put skin in the game — a real name, a real address, a real phone number."
    >
      <motion.div variants={staggerContainer} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_LISTINGS.map((listing) => (
          <motion.div key={listing.id} variants={fadeInUp}>
            <Link
              href={`/listing/${listing.slug}`}
              className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={`h-24 bg-gradient-to-br ${listing.accent} relative`}>
                {listing.verified && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-success backdrop-blur">
                    <ShieldCheck size={12} />
                    Verified
                  </span>
                )}
              </div>
              <div className="p-5">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                  {listing.category}
                </p>
                <h3 className="mb-1 text-lg font-semibold text-gray-900 group-hover:text-primary">
                  {listing.name}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-600">
                  {listing.shortDescription}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                      {listing.avgRating.toFixed(1)}
                      <span className="text-gray-400">({listing.reviewCount})</span>
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-500">
                      {listing.city}, {listing.state}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
                    Trust {listing.trustScore.toFixed(1)}
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
      <motion.div variants={fadeInUp} className="mt-10 text-center">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
        >
          Browse the full directory →
        </Link>
      </motion.div>
    </SectionShell>
  );
}
