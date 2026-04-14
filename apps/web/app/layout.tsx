import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ReferralNetworkUSA';

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: "Find trusted local pros for life's biggest moments.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
