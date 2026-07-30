import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Sign Up Free - No Credit Card Required",
  description: "Create your free Referral Nova account in under a minute. Get AI-matched with referral partners - no credit card required.",
  alternates: { canonical: "/signup/" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
