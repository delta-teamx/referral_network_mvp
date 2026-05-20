import MemberProfileClient from './MemberProfileClient';

export function generateStaticParams() {
  // Member IDs are not known at build time (auth-gated, server-driven). We
  // emit a single placeholder so the static export builds, and rely on the
  // client component to fetch live profile data from useParams() at runtime.
  return [{ userId: 'placeholder' }];
}

export const dynamicParams = true;

export default function Page() {
  return <MemberProfileClient />;
}
