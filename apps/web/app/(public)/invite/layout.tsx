import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Invite & Earn - Referral Leaderboard",
  description: "Invite fellow business owners to Referral Nova, climb the leaderboard, and earn rewards as your invites join and participate.",
  alternates: { canonical: "/invite/" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
