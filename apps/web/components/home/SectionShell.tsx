'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeInUp, staggerContainer } from '../../lib/animations';

interface Props {
  id?: string;
  className?: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Tailwind bg class for the section wrapper. */
  background?: string;
  /** If true, titles are left-aligned instead of centered. */
  alignLeft?: boolean;
}

/**
 * Generic section wrapper. Fades header content in on scroll, then
 * renders children. Keeps vertical rhythm and max-widths consistent
 * across the entire homepage.
 */
export function SectionShell({
  id,
  className = '',
  eyebrow,
  title,
  subtitle,
  children,
  background = 'bg-white',
  alignLeft = false,
}: Props) {
  return (
    <section id={id} className={`${background} px-6 py-16 md:py-24 ${className}`}>
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {(eyebrow || title || subtitle) && (
          <motion.div
            variants={fadeInUp}
            className={`mb-10 md:mb-14 ${alignLeft ? '' : 'text-center'}`}
          >
            {eyebrow && (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={`mt-4 text-base text-gray-600 md:text-lg ${alignLeft ? '' : 'mx-auto max-w-2xl'}`}
              >
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </motion.div>
    </section>
  );
}
