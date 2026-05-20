/**
 * Single source of truth for whitelabel branding. Consumed by both apps:
 *   - apps/web reads it via @refnet/shared for UI copy, Tailwind colors,
 *     email recipients, navigation labels.
 *   - apps/api reads it for outbound email subjects, footer text, and
 *     transactional copy.
 *
 * To rebrand for a new tenant, edit this file (or replace at build time
 * with a per-tenant config). Every hardcoded brand string in the codebase
 * should route through this module — that's the contract.
 *
 * Colors are the canonical hex values. The Tailwind config reads them at
 * build time; runtime overrides happen via CSS variables on :root (see
 * apps/web/app/globals.css).
 */

export interface Branding {
  name: string;          // "NRG"
  fullName: string;      // "NRG Online"
  domain: string;        // "nrg.online"
  url: string;           // "https://nrg.online"
  tagline: string;       // hero line
  description: string;   // meta description, social previews
  shortPitch: string;    // one-line elevator pitch
  valueProps: string[];  // bulleted value props used across marketing pages
  supportEmail: string;
  fromEmail: string;
  social: {
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
  legal: {
    companyName: string;
    address?: string;
    privacyUrl: string;
    termsUrl: string;
  };
  colors: {
    primary: string;       // primary CTA / brand accent
    primaryLight: string;  // tint backgrounds
    primaryDark: string;   // hover / pressed state
    secondary: string;     // warm accent
    success: string;
    danger: string;
    warning: string;
    surface: string;       // page background
    text: string;          // base text color
  };
  fonts: {
    sans: string;          // body
    display?: string;      // headings (optional)
  };
  logo: {
    url: string;           // primary logo (light backgrounds)
    urlDark?: string;      // logo for dark backgrounds
    height: number;        // px, header height
    alt: string;
  };
}

/**
 * Default NRG branding. Colors carry the prior production palette
 * (#1B5E8C primary, #E8913A secondary) which the existing app already
 * shipped — tweak hexes here to rebrand.
 *
 * Logo URL placeholder points at /brand/logo.svg in the public folder.
 * Drop your file there or set NEXT_PUBLIC_BRAND_LOGO_URL at build time.
 */
export const branding: Branding = {
  name: 'NRG',
  fullName: 'NRG Online',
  domain: 'nrg.online',
  url: 'https://nrg.online',
  tagline: 'AI-powered referral networking for serious operators.',
  description:
    'NRG matches members with curated referrals every month, auto-books Zoom intros, and keeps your pipeline warm — without the cold-outreach grind.',
  shortPitch: 'Curated referrals. Auto-booked calls. Real revenue.',
  valueProps: [
    '10 curated referrals delivered to your dashboard each month for your first 3 months.',
    'AI scoring tells you who is a strong fit, a potential connector, or a hidden gem.',
    'One-click intro requests trigger automatic SMS, email, and Zoom booking — no scheduling chase.',
    'Weekly digest surfaces the highest-fit new matches the moment they land.',
    'Regional chapters keep the network local without losing national scale.',
  ],
  supportEmail: 'support@nrg.online',
  fromEmail: 'hello@nrg.online',
  social: {
    linkedin: 'https://www.linkedin.com/company/nrg-online',
  },
  legal: {
    companyName: 'NRG Online, Inc.',
    privacyUrl: '/privacy',
    termsUrl: '/terms',
  },
  colors: {
    primary: '#1B5E8C',
    primaryLight: '#E8F2FA',
    primaryDark: '#134669',
    secondary: '#E8913A',
    success: '#2E7D32',
    danger: '#D32F2F',
    warning: '#ED6C02',
    surface: '#F7F9FC',
    text: '#0F1B2D',
  },
  fonts: {
    // Loaded via next/font/google in apps/web/app/layout.tsx as
    // --font-montserrat. The variable wins at runtime; the literal name
    // here is the fallback referenced by the Tailwind config + email
    // templates.
    sans: 'var(--font-montserrat), Montserrat, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  logo: {
    url: '/brand/logo.svg',
    urlDark: '/brand/logo-dark.svg',
    height: 36,
    alt: 'NRG',
  },
};

export type BrandingKey = keyof Branding;
