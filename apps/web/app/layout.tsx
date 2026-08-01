import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { DomainHead } from "../components/layout/DomainHead";
import { LayoutShell } from "../components/layout/LayoutShell";
import { I18nProvider } from "../lib/i18n";
import { JsonLd, organizationSchema, websiteSchema } from "../components/seo/JsonLd";
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
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="bg-white text-gray-900 antialiased">
        <JsonLd data={[organizationSchema, websiteSchema]} />
        <I18nProvider>
          <DomainHead />
          <LayoutShell>{children}</LayoutShell>
        </I18nProvider>
      </body>
    </html>
  );
}
