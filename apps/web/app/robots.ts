import type { MetadataRoute } from 'next';

/**
 * robots.txt - allow crawling of the marketing site, keep the app + gated
 * routes out of the index, and point crawlers (incl. Bing, which feeds several
 * AI answer engines) at the sitemap.
 *
 * Generated at build time (output: 'export') into /robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/login', '/signup', '/onboarding', '/oauth', '/verify-otp', '/verify-email', '/reset-password', '/forgot-password'],
      },
    ],
    sitemap: 'https://referralnova.com/sitemap.xml',
    host: 'https://referralnova.com',
  };
}
