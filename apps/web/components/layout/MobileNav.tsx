'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Clock, LayoutDashboard, MessageSquare, Users } from 'lucide-react';

/**
 * Mobile bottom navigation. Shown only on <md screens where the sidebar is
 * hidden. 5 most-used dashboard pages. iOS-style tab bar.
 */

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'Calls', icon: Calendar },
  { href: '/dashboard/availability', label: 'Hours', icon: Clock },
  { href: '/dashboard/messages', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/network', label: 'Network', icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white/95 backdrop-blur md:hidden">
      {TABS.map((t) => {
        const active =
          pathname === t.href || (t.href !== '/dashboard' && pathname.startsWith(t.href));
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
              active ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Icon size={18} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
