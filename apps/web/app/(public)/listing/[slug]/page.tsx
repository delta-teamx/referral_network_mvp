import { MOCK_LISTINGS } from '../../../../lib/mockData';
import ListingDetailClient from './ListingDetailClient';
import { AuthGateServer } from './AuthGateWrapper';

export function generateStaticParams() {
  return MOCK_LISTINGS.map((l) => ({ slug: l.slug }));
}

export const dynamicParams = false;

export default function Page() {
  return (
    <AuthGateServer>
      <ListingDetailClient />
    </AuthGateServer>
  );
}
