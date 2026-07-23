'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Network,
  Search,
  UsersRound,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/auth';
import { api } from '../../../lib/api';
import { MobileNav } from '../../../components/layout/MobileNav';
import { NotificationBell } from '../../../components/layout/NotificationBell';
import { UpgradeBanner } from '../../../components/billing/UpgradeBanner';

// Which sidebar tab lights up (red dot) for each unread notification type.
const NOTIFICATION_TAB: Record<string, string> = {
  message: '/dashboard/messages',
  intro_accepted: '/dashboard/messages',
  intro_request: '/dashboard/leads',
  referral: '/dashboard/referrals',
  contract: '/dashboard/referrals',
  booking_request: '/dashboard/bookings',
  booking_confirmed: '/dashboard/bookings',
  booking_declined: '/dashboard/bookings',
};

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/members', label: 'Members', icon: Search },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/leads', label: 'Leads', icon: Inbox },
  { href: '/dashboard/referrals', label: 'Referrals', icon: Users },
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/network', label: 'My network', icon: Network },
  { href: '/dashboard/groups', label: 'Groups', icon: UsersRound },
  { href: '/dashboard/availability', label: 'Availability', icon: Clock },
  { href: '/dashboard/listing', label: 'My listing', icon: Store },
  { href: '/dashboard/settings', label: 'Profile settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [dotTabs, setDotTabs] = useState<Set<string>>(new Set());
  // Netlify serves pretty URLs with a trailing slash (/dashboard/messages/) —
  // normalize so tab matching (active state, dot clearing) actually matches.
  const currentPath = pathname.replace(/\/+$/, '') || '/';

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  // Opening a tab clears its red dot — the dot means "unseen", so seeing the
  // tab marks its notification types read (server + local + bell count).
  useEffect(() => {
    if (!accessToken) return;
    const types = Object.entries(NOTIFICATION_TAB)
      .filter(([, href]) => href === currentPath)
      .map(([type]) => type);
    if (types.length === 0) return;
    setDotTabs((prev) => {
      if (!prev.has(currentPath)) return prev;
      const next = new Set(prev);
      next.delete(currentPath);
      return next;
    });
    void api
      .post('/api/v1/notifications/read-by-types', { types }, { accessToken: accessToken ?? undefined })
      .then(() => {
        // Tell the bell to refresh its badge right away.
        window.dispatchEvent(new Event('rn:notifications-changed'));
      })
      .catch(() => undefined);
  }, [accessToken, currentPath]);

  // Red dots: poll unread notifications and light up the matching tabs.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function poll() {
      try {
        const items = await api.get<Array<{ type: string; isRead: boolean }>>(
          '/api/v1/notifications',
          { accessToken: accessToken ?? undefined, query: { limit: 50 } },
        );
        if (cancelled) return;
        const tabs = new Set<string>();
        for (const n of items) {
          if (!n.isRead && NOTIFICATION_TAB[n.type]) tabs.add(NOTIFICATION_TAB[n.type]!);
        }
        setDotTabs(tabs);
      } catch {
        /* silent */
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, pathname]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?next=/dashboard');
  }, [status, router]);

  useEffect(() => {
    if (user && !user.onboardingCompleted && user.role !== 'ADMIN') {
      router.push('/onboarding');
    }
  }, [user, router]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading dashboard…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-60 flex-shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="px-5 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Signed in as
          </p>
          <p className="mt-1 font-semibold text-gray-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
          <span className="mt-2 inline-block rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
            {user.role.replace('_', ' ')}
          </span>
        </div>
        <nav className="px-3">
          {NAV.map((item) => {
            const active = currentPath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-primary-light font-semibold text-primary'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {item.label}
                {dotTabs.has(item.href) && (
                  <span className="ml-auto h-2.5 w-2.5 rounded-full bg-danger" aria-label="unread" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-gray-200 px-3 py-3">
          <button
            onClick={() => void logout()}
            className="mb-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
          >
            Log out
          </button>
          <div className="px-3 text-[10px] text-gray-400">
            Powered by{' '}
            <a
              href="https://virtualpros.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-gray-500 hover:text-primary"
            >
              Virtual Pros
            </a>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {/* Slim top bar: notifications on every dashboard page */}
        <div className="sticky top-0 z-40 flex h-12 items-center justify-end border-b border-gray-200 bg-white px-4">
          <NotificationBell />
        </div>
        {user.role === 'ADMIN' && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-center text-xs text-amber-900">
            You&rsquo;re signed in as an admin.{' '}
            <Link href="/admin" className="font-semibold underline hover:text-amber-700">
              Open admin console →
            </Link>
          </div>
        )}
        <UpgradeBanner />
        {children}
        <div className="h-16 md:hidden" aria-hidden />
      </main>
      <MobileNav />
    </div>
  );
}
