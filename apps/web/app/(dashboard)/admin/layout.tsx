'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Calendar, LayoutDashboard, Mail, Shield, Sparkles, Store, Users, UsersRound, Video } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/listings', label: 'Listings', icon: Store },
  { href: '/admin/moderation', label: 'Moderation queue', icon: AlertTriangle },
  { href: '/admin/events', label: 'Zoom events', icon: Video },
  { href: '/admin/pods', label: 'AI Pods', icon: Sparkles },
  { href: '/admin/referrals', label: 'Onboarding referrals', icon: Mail },
  { href: '/admin/bookings', label: 'All bookings', icon: Calendar },
  { href: '/admin/groups', label: 'Groups', icon: UsersRound },
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
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
