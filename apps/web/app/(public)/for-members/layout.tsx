import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "For Members - Grow Your Business Through Referrals",
  description: "Join Referral Nova as a business member: AI-matched introductions, warm partner meetings, and tracked referrals that turn your network into revenue.",
  alternates: { canonical: "/for-members/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
