'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { fadeInUp } from '../../lib/animations';
import { SectionShell } from './SectionShell';

export function Newsletter() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Newsletter backend lands later - for now, just acknowledge.
    setSent(true);
  }

  return (
    <SectionShell background="bg-primary-light/40">
      <motion.div
        variants={fadeInUp}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#174a6e] to-[#0d3650] p-10 text-white md:p-14"
      >
        <div
          aria-hidden
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/30 blur-3xl"
        />
        <div className="relative">
          <Mail size={28} className="mb-4 text-secondary" />
          <h2 className="mb-3 text-2xl font-bold md:text-3xl">
            Stay connected with our newsletter
          </h2>
          <p className="mb-6 max-w-lg text-white/80">
            New pros joining your area, group-meeting announcements, and quick tips from the
            network&rsquo;s top performers. One email a week, cancel anytime.
          </p>

          {sent ? (
            <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur">
              🎉 You&rsquo;re on the list. Check your inbox for a confirmation.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur outline-none focus:border-secondary"
              />
              <button
                type="submit"
                className="rounded-xl bg-secondary px-6 py-3 text-sm font-semibold text-white transition hover:bg-secondary/90"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </SectionShell>
  );
}
