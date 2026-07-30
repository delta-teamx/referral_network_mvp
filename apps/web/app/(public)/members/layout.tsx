import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Member Profile",
  description: "View a Referral Nova member's public profile: business info, trust score, and booking availability.",
  alternates: { canonical: "/members/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
