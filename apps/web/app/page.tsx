import { EVENT_TYPE_META } from '@refnet/shared';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ReferralNetworkUSA';

export default function HomePage() {
  const events = Object.values(EVENT_TYPE_META);

  return (
    <main className="min-h-screen">
      <section className="bg-primary-light px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-primary">
            {appName}
          </p>
          <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-5xl">
            Find trusted local pros for life&rsquo;s biggest moments.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Pick what&rsquo;s happening in your life. We&rsquo;ll match you with verified local
            businesses that specialize in exactly what you need.
          </p>
          <div className="mt-6 inline-block rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-900">
            Foundation build (Branch 1). Search, matching, and dashboards land in later branches.
          </div>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-6 text-2xl font-semibold text-gray-900">
            What&rsquo;s happening in your life?
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {events.map((event) => (
              <div
                key={event.type}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <p className="font-medium text-gray-900">{event.label}</p>
                <p className="mt-1 text-sm text-gray-500">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
