import Link from 'next/link';
import { Sparkles } from 'lucide-react';
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
  return (
    <footer className="bg-gray-950 px-6 py-16 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link href="/">
              <BrandLogoWhite />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
              AI-powered referral networking. Stop relying on memory — our engine makes the right
              introductions automatically.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <Sparkles size={12} className="text-primary" />
              Powered by AI matching
            </div>
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
            <p>&copy; {new Date().getFullYear()} VirtualProsNetwork. All rights reserved.</p>
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
