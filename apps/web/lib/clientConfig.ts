export const clientConfig = {
  brand: {
    name: 'NRG',
    tagline: 'AI-Powered Referral Networking Platform',
    description: 'NRG is the AI-powered referral networking platform.',
    url: 'https://nrg-ai.com',
    supportEmail: 'support@nrg-ai.com',
  },
  features: {
    payments: true,
    matching: true,
    bookings: true,
    referrals: true,
    adminPanel: true,
  },
  legal: {
    companyName: 'NRG, Inc.',
    privacyUrl: '/privacy',
    termsUrl: '/terms',
  },
} as const;

export type ClientConfig = typeof clientConfig;
export type FeatureFlag = keyof ClientConfig['features'];

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return clientConfig.features[flag];
}
