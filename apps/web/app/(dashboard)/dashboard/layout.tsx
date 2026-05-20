'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Network,
  Settings,
  Sparkles,
  Store,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/auth';
import { MobileNav } from '../../../components/layout/MobileNav';
import { UpgradeBanner } from '../../../components/billing/UpgradeBanner';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/matches', label: 'Matches', icon: Sparkles },
  { href: '/dashboard/activity', label: 'Activity', icon: Activity },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/leads', label: 'Leads', icon: Inbox },
  { href: '/dashboard/referrals', label: 'Referrals', icon: Users },
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/network', label: 'My network', icon: Network },
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

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

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
            const active = pathname === item.href;
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
            Powered by <span className="font-semibold text-gray-500">NRG</span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
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
