import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { DomainHead } from "../components/layout/DomainHead";
import { LayoutShell } from "../components/layout/LayoutShell";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "Referral Nova - AI-Powered Referral Networking Platform",
    template: "%s | Referral Nova",
  },
  description:
    "Referral Nova is the AI-powered referral networking platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="bg-white text-gray-900 antialiased">
        <I18nProvider>
          <DomainHead />
          <LayoutShell>{children}</LayoutShell>
        </I18nProvider>
      </body>
    </html>
  );
}
