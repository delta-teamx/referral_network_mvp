import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Montserrat } from 'next/font/google';
import { DemoBanner } from '../components/layout/DemoBanner';
import { Footer } from '../components/layout/Footer';
import { TopNav } from '../components/layout/TopNav';
import { SignupPopup } from '../components/marketing/SignupPopup';
import { SignupBanner } from '../components/marketing/SignupBanner';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'VirtualProsNetwork';

export const metadata: Metadata = {
  title: {
    default: `${appName} — AI-Powered Referral Networking`,
    template: `%s | ${appName}`,
  },
  description:
    'AI-powered referral networking. Our engine learns every member’s profile and automatically connects the right people. Like BNI, but powered by artificial intelligence.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="bg-white text-gray-900 antialiased">
        <DemoBanner />
        <TopNav />
        {children}
        <Footer />
        <SignupPopup />
        <SignupBanner />
      </body>
    </html>
  );
}
