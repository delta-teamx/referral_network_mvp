import Link from 'next/link';

const LINK_GROUPS = [
  {
    heading: 'Network',
    links: [
      { href: '/search', label: 'Browse directory' },
      { href: '/connect', label: 'Life-event connector' },
      { href: '/groups', label: 'Networking groups' },
      { href: '/donate-labor', label: 'Donate your labor' },
    ],
  },
  {
    heading: 'For businesses',
    links: [
      { href: '/signup?role=BUSINESS_OWNER', label: 'List your business' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/trust-score', label: 'How trust score works' },
      { href: '/invite', label: 'Invite a peer' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/blog', label: 'Blog' },
      { href: '/press', label: 'Press' },
      { href: '/careers', label: 'Careers' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: '/help', label: 'Help center' },
      { href: '/contact', label: 'Contact' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-gray-950 px-6 py-14 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <Link href="/" className="text-lg font-semibold text-white">
              ReferralNetworkUSA
            </Link>
            <p className="mt-3 text-sm text-gray-400">
              A new kind of referral network — life-event matching, verified trust scores, real B2B
              relationships.
            </p>
          </div>
          {LINK_GROUPS.map((g) => (
            <div key={g.heading}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                {g.heading}
              </h3>
              <ul className="space-y-2">
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
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-800 pt-6 text-xs text-gray-500 md:flex-row">
          <p>© {new Date().getFullYear()} ReferralNetworkUSA. All rights reserved.</p>
          <p>Made in St. Louis for small businesses everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
