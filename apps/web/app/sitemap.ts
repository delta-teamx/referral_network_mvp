import type { MetadataRoute } from 'next';

const BASE = 'https://referralnova.com';

/**
 * Static sitemap of indexable marketing pages. The app subdomain
 * (dashboard.referralnova.com) and gated routes (/dashboard, /admin, /login,
 * onboarding) are intentionally excluded - they should not be indexed.
 *
 * Generated at build time (output: 'export') into /sitemap.xml.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/how-it-works', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/for-members', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/for-groups', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/members', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
    { path: '/trust-score', priority: 0.6, changeFrequency: 'monthly' },
    // AEO content: comparison + educational pages.
    { path: '/compare/referral-nova-vs-linkedin', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/compare/referral-nova-vs-bni', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/compare/referral-nova-vs-traditional-networking', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/learn/how-ai-referral-networks-work', priority: 0.8, changeFrequency: 'monthly' },
    // Industry pages.
    { path: '/industries/referrals-for-realtors', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/industries/referrals-for-contractors', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/industries/referrals-for-med-spas', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/nrg', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];
  const lastModified = '2026-08-01';
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
