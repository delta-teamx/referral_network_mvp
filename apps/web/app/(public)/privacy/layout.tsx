import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Referral Nova collects, uses, and protects your data - including profile info, video introductions, AI transcription, and matching.",
  alternates: { canonical: "/privacy/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
