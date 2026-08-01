import Link from 'next/link';
import type { ReactNode } from 'react';
import { JsonLd, faqSchema } from './JsonLd';
import { APP_BASE_URL } from '../../lib/domains';

/**
 * Shared layout for AEO/SEO content pages (comparisons, guides). Renders a
 * clean hero, the article body (caller supplies H2 sections), an FAQ block with
 * FAQPage schema, and a signup CTA. Server component - all content ships in the
 * static HTML so search + answer engines can read it.
 */
export function ArticleLayout({
  eyebrow,
  title,
  intro,
  children,
  faqs,
  cta = 'Get started with Referral Nova',
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  faqs: Array<{ q: string; a: string }>;
  cta?: string;
}) {
  return (
    <main className="bg-white">
      <JsonLd data={faqSchema(faqs)} />

      <section className="border-b border-gray-100 bg-gradient-to-b from-primary-light/40 to-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-gray-900 sm:text-4xl">{title}</h1>
          <p className="mt-4 text-lg text-gray-600">{intro}</p>
        </div>
      </section>

      <section className="px-6 py-14">
        <article className="mx-auto max-w-3xl space-y-8 [&_h2]:mt-2 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-900 [&_p]:mt-3 [&_p]:leading-relaxed [&_p]:text-gray-700 [&_ul]:mt-3 [&_ul]:space-y-2 [&_li]:text-gray-700">
          {children}
        </article>
      </section>

      {faqs.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50 px-6 py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-gray-900">Frequently asked questions</h2>
            <dl className="mt-6 space-y-6">
              {faqs.map((f) => (
                <div key={f.q} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <dt className="font-semibold text-gray-900">{f.q}</dt>
                  <dd className="mt-2 text-gray-700">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-primary to-blue-700 px-8 py-12 text-center text-white">
          <h2 className="text-2xl font-bold">{cta}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Build a referral engine, not just a contact list. Referral Nova&rsquo;s AI matches you
            with trusted partners so qualified referrals flow both ways.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`${APP_BASE_URL}/signup`}
              className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-primary transition hover:bg-gray-100"
            >
              Get started free
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-white/40 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
