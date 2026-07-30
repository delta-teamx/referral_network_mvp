import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Referral Nova's terms of service: accounts, subscriptions, the founding member offer, referral agreements, e-signatures, and acceptable use.",
  alternates: { canonical: "/terms/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
