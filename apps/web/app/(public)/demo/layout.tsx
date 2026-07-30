import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Live Demo - See the Referral Engine in Action",
  description: "Watch Referral Nova in action: AI partner matching, warm introductions, bookings, and referral tracking - then start free in under a minute.",
  alternates: { canonical: "/demo/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
