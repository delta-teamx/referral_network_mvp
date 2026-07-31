'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Calendar, FileSignature, Headset, LayoutDashboard, MessageSquare, Shield, Trophy, Users, UsersRound, Video } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth';

const NAV: Array<{ href: string; label: string; icon: typeof LayoutDashboard; tag?: string }> = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/admin/events', label: 'Zoom events', icon: Video },
  { href: '/admin/pods', label: 'Matchmaking pods', icon: UsersRound },
  { href: '/admin/bookings', label: 'All bookings', icon: Calendar },
  { href: '/admin/groups', label: 'Groups', icon: UsersRound },
  { href: '/admin/contracts', label: 'Contracts', icon: FileSignature },
  { href: '/admin/support', label: 'Support tickets', icon: Headset },
  { href: '/admin/messages', label: 'Member messages', icon: MessageSquare },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
            const active = pathname === item.href;
            const Icon = item.icon;
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
            console a scrollable tab strip on top. */}
        <div className="flex gap-2 overflow-x-auto border-b border-gray-800 bg-gray-900 px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-amber-500 text-gray-950' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        {children}
      </main>
    </div>
  );
}
