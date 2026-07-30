import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Trust Score - How We Rank and Match Businesses",
  description: "Every Referral Nova business has a 0-10 trust score updated nightly: verified identity, reviews, converted referrals, and endorsements. No pay-to-win.",
  alternates: { canonical: "/trust-score/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
