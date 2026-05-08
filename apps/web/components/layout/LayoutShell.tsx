'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DemoBanner } from './DemoBanner';
import { Footer } from './Footer';
import { TopNav } from './TopNav';
import { SignupPopup } from '../marketing/SignupPopup';
import { SignupBanner } from '../marketing/SignupBanner';

const ALWAYS_HIDE = ['/dashboard', '/admin', '/onboarding', '/verify-otp'];
const VPN_ALSO_HIDE = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isVpn = typeof window !== 'undefined' &&
    (window.location.hostname === 'virtualprosnetwork.com' || window.location.hostname === 'www.virtualprosnetwork.com');

  const hideShell = ALWAYS_HIDE.some((p) => pathname.startsWith(p)) ||
    (isVpn && VPN_ALSO_HIDE.some((p) => pathname.startsWith(p)));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <>
      <DemoBanner />
      <TopNav />
      {children}
      <Footer />
      <SignupPopup />
      <SignupBanner />
    </>
  );
}
