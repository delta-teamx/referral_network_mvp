import { MOCK_LISTINGS } from '../../../../lib/mockData';
import ListingDetailClient from './ListingDetailClient';

export function generateStaticParams() {
  return MOCK_LISTINGS.map((l) => ({ slug: l.slug }));
}

export default function Page() {
  return <ListingDetailClient />;
}
