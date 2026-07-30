import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to your Referral Nova account to see your matches, messages, bookings, and referrals.",
  alternates: { canonical: "/login/" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
