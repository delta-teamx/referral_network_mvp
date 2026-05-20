import { branding } from '@refnet/shared';

/**
 * Web client config. Branding is sourced from packages/shared so it's
 * a single source of truth across web + API. Feature flags stay here
 * since they're web-specific (gate UI surfaces, not data).
 */
export const clientConfig = {
  brand: {
    name: branding.name,
    fullName: branding.fullName,
    tagline: branding.tagline,
    description: branding.description,
    shortPitch: branding.shortPitch,
    url: branding.url,
    supportEmail: branding.supportEmail,
    logo: branding.logo,
    valueProps: branding.valueProps,
    social: branding.social,
  },
  features: {
    payments: true,
    matching: true,
    bookings: true,
    referrals: true,
    adminPanel: true,
  },
  legal: branding.legal,
} as const;

export type ClientConfig = typeof clientConfig;
export type FeatureFlag = keyof ClientConfig['features'];

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return clientConfig.features[flag];
}
