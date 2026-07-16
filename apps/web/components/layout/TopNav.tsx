'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useI18n } from '../../lib/i18n';
import { BrandLogo } from '../ui/BrandLogo';
import { ReferralNovaLogo } from '../ui/ReferralNovaLogo';
import { NotificationBell } from './NotificationBell';
import { LanguageSwitcher } from './LanguageSwitcher';

const NAV_LINKS = [
  { href: '/how-it-works', key: 'nav.howItWorks' },
  { href: '/for-members', key: 'nav.forMembers' },
  { href: '/for-groups', key: 'nav.forGroups' },
  { href: '/events', key: 'nav.events' },
  { href: '/pricing', key: 'nav.pricing' },
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

  const isVpnDomain = typeof window !== 'undefined' &&
    (window.location.hostname === 'virtualprosnetwork.com' || window.location.hostname === 'www.virtualprosnetwork.com');
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot') || pathname.startsWith('/verify') || pathname.startsWith('/onboarding');
  const isDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  const Logo = (isDashboard || isVpnDomain) ? BrandLogo : ReferralNovaLogo;
  const vpnBase = (isDashboard || isVpnDomain) ? '' : 'https://virtualprosnetwork.com';
  const logoHref = isDashboard ? (user ? '/dashboard' : '/login')
    : isAuthPage ? 'https://referralnova.com'
    : isVpnDomain ? '/login'
    : '/';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <a href={logoHref}>
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
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
          <LanguageSwitcher className="hidden md:block" />
          {status === 'authenticated' && user ? (
            <>
              <NotificationBell />
              <a
                href={`${vpnBase}/dashboard`}
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
              {!isVpnDomain && (
                <a
                  href="/demo"
                  className="hidden rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white lg:inline"
                >
                  Live Demo
                </a>
              )}
              <a
                href={`${vpnBase}/login`}
                className="hidden rounded-md px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 md:inline"
              >
                {t('nav.login')}
              </a>
              <a
                href={`${vpnBase}/signup`}
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
            {NAV_LINKS.map((link) => (
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
                href={`${vpnBase}/login`}
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-md px-3 py-2.5 text-sm font-medium text-primary"
              >
                {t('nav.login')}
              </a>
            ) : (
              <>
                <a
                  href={`${vpnBase}/dashboard`}
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
            <div className="mt-2 border-t border-gray-100 pt-2">
              <LanguageSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
