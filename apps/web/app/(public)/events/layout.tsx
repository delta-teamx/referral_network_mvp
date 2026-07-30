import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Networking Events - Live Zoom Referral Sessions",
  description: "Register for Referral Nova's live Zoom networking events: orientation sessions, referral rooms, and expert panels. Save your seat and get the link by email.",
  alternates: { canonical: "/events/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
