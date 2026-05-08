'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { DemoBanner } from './DemoBanner';
import { Footer } from './Footer';
import { TopNav } from './TopNav';
import { SignupPopup } from '../marketing/SignupPopup';
import { SignupBanner } from '../marketing/SignupBanner';

const ALWAYS_HIDE = ['/dashboard', '/admin', '/onboarding', '/verify-otp'];

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideShell = ALWAYS_HIDE.some((p) => pathname.startsWith(p));

  if (hideShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <TopNav />
      <div className="flex flex-1 flex-col">{children}</div>
      <Footer />
      <SignupPopup />
      <SignupBanner />
    </div>
  );
}
