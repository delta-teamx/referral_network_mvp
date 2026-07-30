import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Pricing - Free, Pro & Premium Plans",
  description: "Referral Nova pricing: start free, upgrade to Pro or Premium for advanced AI matching and referral tools. Founding businesses get lifetime Premium free.",
  alternates: { canonical: "/pricing/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
