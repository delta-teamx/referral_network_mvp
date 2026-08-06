import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { DomainHead } from "../components/layout/DomainHead";
import { LayoutShell } from "../components/layout/LayoutShell";
import { I18nProvider } from "../lib/i18n";
import { JsonLd, organizationSchema, websiteSchema, softwareApplicationSchema } from "../components/seo/JsonLd";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://referralnova.com"),
  title: {
    default: "Referral Nova - AI-Powered Referral Networking Platform",
    template: "%s | Referral Nova",
  },
  description:
    "Stop hoping for referrals - build a referral engine. Referral Nova's AI matches your business with trusted partners so qualified referrals flow both ways.",
  alternates: { canonical: "/" },
  keywords: [
    "referral network",
    "business referrals",
    "AI networking",
    "B2B referrals",
    "referral marketing",
    "business networking platform",
    "warm introductions",
  ],
  openGraph: {
    type: "website",
    siteName: "Referral Nova",
    url: "https://referralnova.com",
    title: "Referral Nova - AI-Powered Referral Networking Platform",
    description:
      "Stop hoping for referrals - build a referral engine. Referral Nova's AI matches your business with trusted partners so qualified referrals flow both ways.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Referral Nova - AI-Powered Referral Networking Platform",
    description:
      "Referral Nova's AI matches your business with trusted partners so qualified referrals flow both ways.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="bg-white text-gray-900 antialiased">
        <JsonLd data={[organizationSchema, websiteSchema, softwareApplicationSchema]} />
        <I18nProvider>
          <DomainHead />
          <LayoutShell>{children}</LayoutShell>
        </I18nProvider>
      </body>
    </html>
  );
}
