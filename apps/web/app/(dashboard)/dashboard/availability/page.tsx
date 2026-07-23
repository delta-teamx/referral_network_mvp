'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Availability now lives inside Bookings (calendar + hours in one place).
 * Keep the old URL working for bookmarks and older links.
 */
export default function AvailabilityRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/bookings');
  }, [router]);
  return (
    <div className="flex min-h-64 items-center justify-center">
      <p className="text-sm text-gray-500">Availability moved into Bookings — taking you there…</p>
    </div>
  );
}
