'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BarChart3, Bot, Calendar, Coins, FileSignature, GraduationCap, Headset, LayoutDashboard, MessageSquare, Shield, Trophy, Users, UsersRound, Video } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth';

type IconType = typeof LayoutDashboard;
type NavLeaf = { href: string; label: string; icon: IconType; tag?: string };
type NavGroup = { label: string; icon: IconType; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

// Grouped console nav: related tools collapse under one entry with an in-page
// switcher. Existing /admin/* routes are unchanged, so deep links still work.
const NAV: NavEntry[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  {
    label: 'People',
    icon: Users,
    children: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/messages', label: 'Member messages', icon: MessageSquare },
      { href: '/admin/support', label: 'Support tickets', icon: Headset },
      { href: '/admin/roul', label: 'ROUL console', icon: Bot },
    ],
  },
  {
    label: 'Growth',
    icon: Trophy,
    children: [
      { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
      { href: '/admin/rewards', label: 'Rewards & points', icon: Coins },
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Events',
    icon: Video,
    children: [
      { href: '/admin/events', label: 'Zoom events', icon: Video },
      { href: '/admin/pods', label: 'Matchmaking pods', icon: UsersRound },
      { href: '/admin/bookings', label: 'All bookings', icon: Calendar },
    ],
  },
  { href: '/admin/groups', label: 'Groups', icon: UsersRound },
  { href: '/admin/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/admin/tutorials', label: 'Tutorials', icon: GraduationCap },
];

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e;
}

function matchHref(current: string, href: string): boolean {
  if (href === '/admin') return current === '/admin';
  return current === href || current.startsWith(href + '/');
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname.replace(/\/+$/, '') || '/';
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?next=/admin');
    else if (status === 'authenticated' && user && user.role !== 'ADMIN') router.push('/dashboard');
  }, [status, user, router]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-300">
        <p className="text-sm">Loading admin console…</p>
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900 md:block">
        <div className="border-b border-gray-800 px-5 py-5">
          <div className="flex items-center gap-2 text-amber-400">
            <Shield size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">Admin</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-gray-400">{user.email}</p>
        </div>
        <nav className="px-3 py-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            if (isGroup(item)) {
              const active = item.children.some((c) => matchHref(currentPath, c.href));
              return (
                <Link
                  key={item.label}
                  href={item.children[0]!.href}
                  className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-amber-500/10 font-semibold text-amber-400'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
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
                    ? 'bg-amber-500/10 font-semibold text-amber-400'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Icon size={16} />
                {item.label}
                {item.tag && (
                  <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
                    {item.tag}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            className="mt-6 inline-block px-3 text-xs text-gray-500 hover:text-gray-300"
          >
            ← Exit admin
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        {/* Phones/tablets in portrait: the sidebar is hidden, so give the
            console a scrollable top-level tab strip. */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-800 bg-gray-900 px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const href = isGroup(item) ? item.children[0]!.href : item.href;
            const active = isGroup(item)
              ? item.children.some((c) => matchHref(currentPath, c.href))
              : matchHref(currentPath, item.href);
            return (
              <Link
                key={item.label}
                href={href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-amber-500 text-gray-950' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        {/* In-page switcher for the active group (desktop + mobile). */}
        {(() => {
          const group = NAV.find(
            (e): e is NavGroup => isGroup(e) && e.children.some((c) => matchHref(currentPath, c.href)),
          );
          if (!group || group.children.length < 2) return null;
          return (
            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-800 bg-gray-900/60 px-4 py-2 sm:px-6">
              {group.children.map((c) => {
                const active = matchHref(currentPath, c.href);
                const CIcon = c.icon;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      active ? 'bg-amber-500 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <CIcon size={14} />
                    {c.label}
                  </Link>
                );
              })}
            </div>
          );
        })()}
        {children}
      </main>
    </div>
  );
}
