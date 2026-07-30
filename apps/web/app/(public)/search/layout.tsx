import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Member Directory - Browse Trusted Professionals",
  description: "Browse the Referral Nova member directory: verified business profiles with trust scores, AI-matched connections, and bookable availability.",
  alternates: { canonical: "/search/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
