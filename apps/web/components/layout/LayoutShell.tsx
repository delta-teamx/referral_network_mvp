'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DemoBanner } from './DemoBanner';
import { Footer } from './Footer';
import { TopNav } from './TopNav';
import { SignupPopup } from '../marketing/SignupPopup';
import { SignupBanner } from '../marketing/SignupBanner';

const HIDE_SHELL_PREFIXES = ['/dashboard', '/admin', '/onboarding', '/verify-otp'];

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideShell = HIDE_SHELL_PREFIXES.some((p) => pathname.startsWith(p));

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
