import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "About Us - Why We Built Referral Nova",
  description: "Referral Nova exists to turn professional networks into referral engines. Learn who we are and why we built an AI-powered referral platform.",
  alternates: { canonical: "/about/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
