'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DemoBanner } from './DemoBanner';
import { Footer } from './Footer';
import { TopNav } from './TopNav';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { isAppHost } from '../../lib/domains';

const ALWAYS_HIDE = ['/dashboard', '/admin', '/onboarding', '/verify-otp'];

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The app subdomain (dashboard.referralnova.com) never shows the marketing
  // chrome — the dashboard has its own sidebar and auth pages are self-styled.
  // isAppHost() needs window, so resolve it after mount to keep SSR consistent.
  const [onAppHost, setOnAppHost] = useState(false);
  useEffect(() => {
    setOnAppHost(isAppHost());
  }, []);

  const hideShell = onAppHost || ALWAYS_HIDE.some((p) => pathname.startsWith(p));
  // Support chat floats on the marketing site and the member dashboard —
  // everywhere except the admin console (agents answer from there).
  const showSupport = !pathname.startsWith('/admin');

  if (hideShell) {
    return (
      <>
        {children}
        {showSupport && <SupportChatWidget />}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <TopNav />
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer />
      {showSupport && <SupportChatWidget />}
    </div>
  );
}
