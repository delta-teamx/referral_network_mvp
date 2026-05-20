import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { branding } from "@refnet/shared";
import { DomainHead } from "../components/layout/DomainHead";
import { LayoutShell } from "../components/layout/LayoutShell";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: `${branding.fullName} — ${branding.tagline}`,
    template: `%s | ${branding.name}`,
  },
  description: branding.description,
  openGraph: {
    title: `${branding.fullName} — ${branding.tagline}`,
    description: branding.description,
    siteName: branding.fullName,
    url: branding.url,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="bg-white text-gray-900 antialiased">
        <DomainHead />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
