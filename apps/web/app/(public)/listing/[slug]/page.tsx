import { MOCK_LISTINGS } from '../../../../lib/mockData';
import ListingDetailClient from './ListingDetailClient';

/**
 * Static export: pre-render one listing page per mock slug so Netlify can
 * serve them as plain HTML. At runtime the client component fetches details
 * (via the api.ts mock fallback) and rehydrates.
 */
export function generateStaticParams() {
  return MOCK_LISTINGS.map((l) => ({ slug: l.slug }));
}

export const dynamicParams = false;

export default function Page() {
  return <ListingDetailClient />;
}
