'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { MapPin, Search } from 'lucide-react';
import { CATEGORY_SEEDS } from '@refnet/shared';
import { SectionShell } from './SectionShell';
import { fadeInUp } from '../../lib/animations';

export function SearchBar() {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const zip = String(form.get('zip') ?? '').trim();
    const category = String(form.get('category') ?? '').trim();
    const params = new URLSearchParams();
    if (zip) params.set('zip', zip);
    if (category) params.set('category', category);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <SectionShell
      id="search"
      eyebrow="Directory"
      title="Find a recommended pro"
      subtitle="Or search the directory directly if you already know what you need."
    >
      <motion.form
        variants={fadeInUp}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-primary/5 sm:flex-row sm:items-center sm:gap-2"
      >
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-4 py-3 sm:w-40">
          <MapPin size={16} className="text-gray-400" />
          <input
            name="zip"
            placeholder="ZIP"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <select
          name="category"
          defaultValue=""
          className="flex-1 rounded-xl bg-gray-50 px-4 py-3 text-sm outline-none"
        >
          <option value="">Any category</option>
          {CATEGORY_SEEDS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          <Search size={16} />
          Search
        </button>
      </motion.form>
    </SectionShell>
  );
}
