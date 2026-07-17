import ListingDetailClient from './ListingDetailClient';
import { AuthGateServer } from './AuthGateWrapper';

// One placeholder shell is prerendered for the static export; the real slug is
// read from the URL at runtime and the listing is fetched live from the API
// (Netlify rewrites every /listing/* path to this shell).
export function generateStaticParams() {
  return [{ slug: 'listing' }];
}

export default function Page() {
  return (
    <AuthGateServer>
      <ListingDetailClient />
    </AuthGateServer>
  );
}
