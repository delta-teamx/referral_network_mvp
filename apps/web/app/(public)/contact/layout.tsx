import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Questions about Referral Nova? Contact our team - we read every message and reply fast.",
  alternates: { canonical: "/contact/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
