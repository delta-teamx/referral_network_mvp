'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { isAppHost } from '../../../lib/domains';
import { MemberProfileView } from '../../../components/members/MemberProfileView';

/**
 * Public member profile. On the app domain this page redirects into the
 * dashboard version (sidebar layout, no marketing chrome); on the marketing
 * site it renders the public standalone card.
 */
function MemberProfileInner() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const onApp = typeof window !== 'undefined' && isAppHost();

  useEffect(() => {
    if (onApp) {
      window.location.replace(`/dashboard/members/profile?id=${encodeURIComponent(id)}`);
    }
  }, [onApp, id]);

  if (onApp) {
    return <main className="min-h-screen bg-primary-light" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
      <MemberProfileView id={id} />
    </main>
  );
}

export default function MemberProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50" />
      }
    >
      <MemberProfileInner />
    </Suspense>
  );
}
