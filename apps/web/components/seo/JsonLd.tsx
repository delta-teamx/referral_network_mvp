/**
 * Renders a JSON-LD <script> block for structured data (schema.org). Search
 * engines and AI answer engines (ChatGPT, Google AI Overviews, Perplexity,
 * Bing Copilot) read this to understand what a page is about.
 *
 * Server component - the markup ships in the static HTML, no client JS.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Schema payloads are our own trusted, static content.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const MARKETING_URL = 'https://referralnova.com';

/** Site-wide Organization schema - who Referral Nova is. */
export const organizationSchema: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Referral Nova',
  legalName: 'Referral Nova',
  url: MARKETING_URL,
  logo: `${MARKETING_URL}/logo.png`,
  description:
    'Referral Nova is an AI-powered referral network that creates meaningful business introductions instead of social media connections. Its matching engine pairs businesses with trusted partners so qualified referrals flow both ways.',
  sameAs: [] as string[],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${MARKETING_URL}/contact`,
  },
};

/** WebSite schema with a search action, so engines understand the site. */
export const websiteSchema: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Referral Nova',
  url: MARKETING_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${MARKETING_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

/** Build a FAQPage schema from a list of Q&A pairs. */
export function faqSchema(faqs: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
