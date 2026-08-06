'use client';

import { Banknote, Check, ExternalLink, Megaphone, Monitor, TrendingUp, Wrench } from 'lucide-react';

/**
 * Business Funding - a member-facing page explaining the lending offer, with a
 * clear CTA out to our lending partner's application. Available to every member
 * (no plan gate) so anyone who needs capital can apply.
 */

const APPLY_URL = 'https://lendtrack.ai/partner/brian-parnell';

const USE_CASES = [
  { icon: Megaphone, label: 'Marketing & advertising' },
  { icon: Monitor, label: 'A new website or rebrand' },
  { icon: Wrench, label: 'Equipment & tools' },
  { icon: TrendingUp, label: 'General growth & working capital' },
];

export default function FundingPage() {
  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Banknote size={14} /> Business Funding
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Need capital to grow your business?</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Through our lending partner, Referral Nova members can apply for business funding for
          whatever moves you forward — marketing, a new website, equipment, or general growth.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-900">What you can fund</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {USE_CASES.map((u) => (
              <li
                key={u.label}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
              >
                <u.icon size={18} className="shrink-0 text-primary" />
                <span className="text-sm font-medium text-gray-800">{u.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2">
            {[
              'Quick online application — takes just a few minutes',
              'Built for small businesses and service providers',
              'Checking your options is fast and simple',
            ].map((line) => (
              <p key={line} className="flex items-start gap-2 text-sm text-gray-700">
                <Check size={16} className="mt-0.5 shrink-0 text-success" />
                {line}
              </p>
            ))}
          </div>

          <a
            href={APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            Apply for funding <ExternalLink size={15} />
          </a>
          <p className="mt-3 text-xs text-gray-400">
            Opens our lending partner&rsquo;s secure application in a new tab. Referral Nova is not a
            lender and is not a party to any financing; approval, terms, and rates are determined by
            the lending partner.
          </p>
        </div>

        {/* Side card */}
        <aside className="rounded-2xl border border-primary/20 bg-primary-light/40 p-6">
          <h3 className="text-sm font-bold text-gray-900">How it works</h3>
          <ol className="mt-3 space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                1
              </span>
              Tap “Apply for funding” to open the partner application.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                2
              </span>
              Tell them about your business and what you need.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                3
              </span>
              Review your funding options and move your business forward.
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
