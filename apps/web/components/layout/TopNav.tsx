'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useI18n } from '../../lib/i18n';
import { APP_BASE_URL, MARKETING_BASE_URL, isAppHost } from '../../lib/domains';
import { ReferralNovaLogo } from '../ui/ReferralNovaLogo';
import { NotificationBell } from './NotificationBell';

const NAV_LINKS = [
  { href: '/how-it-works', key: 'nav.howItWorks' },
  { href: '/for-members', key: 'nav.forMembers' },
  { href: '/for-groups', key: 'nav.forGroups' },
  { href: '/events', key: 'nav.events' },
  { href: '/pricing', key: 'nav.pricing' },
];

// On the app domain the header is part of the product, not the marketing site —
// link to the app's own sections instead of marketing pages.
const APP_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/members', label: 'Members' },
  { href: '/dashboard/messages', label: 'Messages' },
  { href: '/dashboard/groups', label: 'Groups' },
  { href: '/dashboard/bookings', label: 'Bookings' },
];

export function TopNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  const isAppDomain = isAppHost();
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot') || pathname.startsWith('/verify') || pathname.startsWith('/onboarding');
  const isDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  const Logo = ReferralNovaLogo;
  // On the app domain the links are same-origin; from the marketing site they
  // point at the app domain.
  const appBase = (isDashboard || isAppDomain) ? '' : APP_BASE_URL;
  const logoHref = isDashboard ? (user ? '/dashboard' : '/login')
    : isAuthPage ? MARKETING_BASE_URL
    : isAppDomain ? '/login'
    : '/';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <a href={logoHref}>
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {isAppDomain
            ? APP_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {link.label}
                </Link>
              ))
            : NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                >
                  {t(link.key)}
                </Link>
              ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === 'authenticated' && user ? (
            <>
              <NotificationBell />
              <a
                href={`${appBase}/dashboard`}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                {t('nav.dashboard')}
              </a>
              <button
                onClick={() => void logout()}
                className="hidden rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 md:inline"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              {!isAppDomain && (
                <a
                  href="/demo"
                  className="hidden rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white lg:inline"
                >
                  Live Demo
                </a>
              )}
              <a
                href={`${appBase}/login`}
                className="hidden rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 md:inline"
              >
                {t('nav.login')}
              </a>
              <a
                href={`${appBase}/signup`}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                {t('nav.signup')}
              </a>
            </>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {isAppDomain
              ? APP_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {link.label}
                  </Link>
                ))
              : NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t(link.key)}
                  </Link>
                ))}
            {!user ? (
              <a
                href={`${appBase}/login`}
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-md px-3 py-2.5 text-sm font-medium text-primary"
              >
                {t('nav.login')}
              </a>
            ) : (
              <>
                <a
                  href={`${appBase}/dashboard`}
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 rounded-md px-3 py-2.5 text-sm font-medium text-primary"
                >
                  {t('nav.dashboard')}
                </a>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-sm text-gray-500 hover:bg-gray-50"
                >
                  {t('nav.logout')}
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
