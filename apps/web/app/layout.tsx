import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '../components/layout/Footer';
import { TopNav } from '../components/layout/TopNav';
import './globals.css';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ReferralNetworkUSA';

export const metadata: Metadata = {
  title: {
    default: `${appName} — Trusted local pros, matched to life's moments`,
    template: `%s | ${appName}`,
  },
  description:
    "Find trusted local pros for life's biggest moments. Life-event matching, verified trust scores, real B2B referral networks.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <TopNav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
