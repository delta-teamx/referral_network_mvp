'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Calendar,
  FileSignature,
  KanbanSquare,
  LayoutDashboard,
  MessageSquare,
  Network,
  Gift,
  Search,
  Trophy,
  UsersRound,
  Settings,
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
  booking_reminder: '/dashboard/bookings',
};

type IconType = typeof LayoutDashboard;
type NavLeaf = { href: string; label: string; icon: IconType; tag?: string };
type NavGroup = { label: string; icon: IconType; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

// Grouped navigation: related tabs collapse under one top-level entry, with an
// in-page switcher to move between them. Existing routes are untouched, so deep
// links and notification click-throughs still land on the right page.
const NAV: NavEntry[] = [
  { href: '/dashboard', label: 'AI Matches', icon: LayoutDashboard },
  {
    label: 'Network',
    icon: Network,
    children: [
      { href: '/dashboard/members', label: 'Members', icon: Search },
      { href: '/dashboard/network', label: 'My network', icon: Network },
    ],
  },
  { href: '/dashboard/groups', label: 'Groups', icon: UsersRound },
  {
    label: 'Pipeline',
    icon: KanbanSquare,
    children: [
      { href: '/dashboard/leads', label: 'Pipeline', icon: KanbanSquare },
      { href: '/dashboard/bookings', label: 'Calendar', icon: Calendar },
      { href: '/dashboard/referrals', label: 'Contracts', icon: FileSignature },
    ],
  },
  {
    label: 'Growth',
    icon: Trophy,
    children: [
      { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/rewards', label: 'Rewards', icon: Gift },
    ],
  },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/settings', label: 'Profile settings', icon: Settings },
];

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e;
}

/** Route match that also lights up on sub-routes (e.g. /members/profile). */
function matchHref(current: string, href: string): boolean {
  if (href === '/dashboard') return current === '/dashboard';
  return current === href || current.startsWith(href + '/');
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [dotTabs, setDotTabs] = useState<Set<string>>(new Set());
  // Netlify serves pretty URLs with a trailing slash (/dashboard/messages/) -
  // normalize so tab matching (active state, dot clearing) actually matches.
  const currentPath = pathname.replace(/\/+$/, '') || '/';

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  // The persisted user object can be days old (tokens last 7 days), so admin
  // changes like a plan upgrade never showed until re-login. Re-sync the user
  // from the server once per dashboard mount - AFTER hydration provides the
  // token (a mount-only effect ran before the token existed and never fired).
  const refreshUserOnMount = useAuthStore((s) => s.refreshUser);
  const didSyncUser = useRef(false);
  useEffect(() => {
    if (!accessToken || didSyncUser.current) return;
    didSyncUser.current = true;
    void refreshUserOnMount();
  }, [accessToken, refreshUserOnMount]);

  // Opening a tab clears its red dot - the dot means "unseen", so seeing the
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

  // Onboarding gate. The persisted user object can be STALE (someone who just
  // finished step 4 still carries onboardingCompleted=false in this tab), so
  // never bounce on the cached flag alone - re-sync from the server first and
  // only redirect if onboarding is genuinely incomplete.
  const refreshUser = useAuthStore((s) => s.refreshUser);
  useEffect(() => {
    if (!user || user.onboardingCompleted || user.role === 'ADMIN') return;
    let cancelled = false;
    void refreshUser().then(() => {
      if (cancelled) return;
      const fresh = useAuthStore.getState().user;
      if (fresh && !fresh.onboardingCompleted && fresh.role !== 'ADMIN') {
        router.push('/onboarding');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.onboardingCompleted, user?.role, refreshUser, router]); // eslint-disable-line react-hooks/exhaustive-deps

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
            const Icon = item.icon;
            if (isGroup(item)) {
              const active = item.children.some((c) => matchHref(currentPath, c.href));
              const hasDot = item.children.some((c) => dotTabs.has(c.href));
              return (
                <Link
                  key={item.label}
                  href={item.children[0]!.href}
                  className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    active ? 'bg-primary-light font-semibold text-primary' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                  {hasDot && (
                    <span className="ml-auto h-2.5 w-2.5 rounded-full bg-danger" aria-label="unread" />
                  )}
                </Link>
              );
            }
            const active = matchHref(currentPath, item.href);
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
                {item.tag && (
                  <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                    {item.tag}
                  </span>
                )}
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
        {/* Slim top bar: brand on phones (no sidebar there) + notifications */}
        <div className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
          <Link href="/dashboard" className="text-sm font-bold text-primary md:invisible">
            Referral Nova
          </Link>
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
        {(() => {
          const group = NAV.find(
            (e): e is NavGroup => isGroup(e) && e.children.some((c) => matchHref(currentPath, c.href)),
          );
          if (!group || group.children.length < 2) return null;
          return (
            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 sm:px-6">
              {group.children.map((c) => {
                const active = matchHref(currentPath, c.href);
                const CIcon = c.icon;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <CIcon size={14} />
                    {c.label}
                    {dotTabs.has(c.href) && !active && (
                      <span className="h-2 w-2 rounded-full bg-danger" aria-label="unread" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })()}
        {children}
        <div className="h-16 md:hidden" aria-hidden />
      </main>
      <MobileNav />
    </div>
  );
}
