'use client';

import Link from 'next/link';
import { ReferralNovaLogoWhite } from '../ui/ReferralNovaLogo';
import { BrandLogoWhite } from '../ui/BrandLogo';

const LINK_GROUPS = [
  {
    heading: 'Platform',
    links: [
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/events', label: 'Networking Events' },
      { href: '/groups', label: 'Browse Groups' },
      { href: '/search', label: 'Member Directory' },
    ],
  },
  {
    heading: 'For Members',
    links: [
      { href: '/signup', label: 'Join free' },
      { href: '/for-members', label: 'Why join?' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/trust-score', label: 'Trust scores' },
    ],
  },
  {
    heading: 'For Organizations',
    links: [
      { href: '/for-groups', label: 'White-label for groups' },
      { href: '/for-groups#pricing', label: 'Group pricing' },
      { href: '/for-groups#demo', label: 'Request a demo' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export function Footer() {
  const isVpn = typeof window !== 'undefined' &&
    (window.location.hostname === 'virtualprosnetwork.com' || window.location.hostname === 'www.virtualprosnetwork.com');

  return (
    <footer className="bg-gray-950 px-6 py-16 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-1">
            <a href={isVpn ? 'https://referralnova.com' : '/'}>
              {isVpn ? <BrandLogoWhite /> : <ReferralNovaLogoWhite />}
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
              The AI-powered referral networking platform. Build real relationships, get warm introductions, close more deals.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Powering <span className="font-semibold text-gray-400">VirtualProsNetwork</span> and other referral communities.
            </p>
          </div>

          {/* Link columns */}
          {LINK_GROUPS.map((g) => (
            <div key={g.heading}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {g.heading}
              </h3>
              <ul className="space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-gray-400 transition hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-gray-500 md:flex-row">
            <div>
              <p>&copy; {new Date().getFullYear()} {isVpn ? 'VirtualProsNetwork' : 'Referral Nova'}. All rights reserved.</p>
              {!isVpn && <p className="mt-1 text-gray-600">Powering <span className="font-semibold text-gray-400">VirtualProsNetwork</span></p>}
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-gray-300">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-gray-300">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-gray-300">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
