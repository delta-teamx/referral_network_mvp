import { Wrench } from 'lucide-react';

/**
 * "Under maintenance" screen shown on /login and /signup (and /maintenance)
 * while NEXT_PUBLIC_MAINTENANCE_MODE=1 during the migration cutover.
 */
export function MaintenanceNotice() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
          <Wrench size={30} />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">We&rsquo;ll be right back</h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          Referral Nova is undergoing a short upgrade. Sign-up and log-in are paused for a little
          while — please check back soon. Thanks for your patience!
        </p>
        <a
          href="https://referralnova.com"
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          Back to Referral Nova
        </a>
      </div>
    </main>
  );
}
