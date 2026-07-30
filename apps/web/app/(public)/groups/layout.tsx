import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Find a Referral Networking Group Near You",
  description: "Browse Referral Nova networking groups by name and state. One seat per category, BNI-style circles - join an existing group or start your own.",
  alternates: { canonical: "/groups/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
