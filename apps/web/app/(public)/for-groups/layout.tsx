import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "For Networking Groups & Chambers",
  description: "Run your BNI-style chapter, chamber, or referral group on Referral Nova: member matching, referral tracking, events, and engagement - on autopilot.",
  alternates: { canonical: "/for-groups/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
