'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  KanbanSquare,
  LayoutDashboard,
  MessageSquare,
} from 'lucide-react';

/**
 * Mobile bottom navigation. Shown only on <md screens where the sidebar is
 * hidden. On mobile the product is focused: Messages, Pipeline, Calendar and
 * Analytics (plus Home). Everything else is desktop/tablet.
 */

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { href: '/dashboard/leads', label: 'Pipeline', icon: KanbanSquare },
  { href: '/dashboard/bookings', label: 'Calendar', icon: Calendar },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
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
