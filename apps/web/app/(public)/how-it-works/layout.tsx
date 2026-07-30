import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "How It Works - AI Referral Matching in 4 Steps",
  description: "See how Referral Nova works: build your profile, get AI-matched with trusted partners, meet on Zoom, and exchange tracked referrals - week after week.",
  alternates: { canonical: "/how-it-works/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
