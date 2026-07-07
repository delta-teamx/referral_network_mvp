export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 mb-2 text-4xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: April 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Acceptance of terms</h2>
            <p>
              By creating an account on Referral Nova, you agree to these terms. If you
              don&rsquo;t agree, don&rsquo;t use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. Your account</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login
              credentials. You agree to provide accurate business information in your profile.
              We may suspend accounts that provide false information or violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6">
              <li>Spam other members with unsolicited sales pitches.</li>
              <li>Create multiple accounts or impersonate others.</li>
              <li>Use the platform for illegal activities.</li>
              <li>Scrape, copy, or resell member data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Subscriptions</h2>
            <p>
              Paid plans (Pro and Premium) are billed monthly via Stripe. You can cancel at
              any time - cancellation takes effect at the end of the current billing period.
              We do not issue prorated refunds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">5. Referrals and bookings</h2>
            <p>
              We facilitate introductions but don&rsquo;t guarantee business outcomes. Any
              agreements, deals, or services exchanged between members are solely between
              those members. We are not responsible for disputes or payment issues between
              members.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Content</h2>
            <p>
              You own the content you upload (video intros, descriptions, photos). By
              uploading, you grant us a non-exclusive license to display it to other members.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">7. Termination</h2>
            <p>
              We may suspend or terminate your account for violations of these terms. You may
              delete your account at any time from your dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Changes</h2>
            <p>
              We may update these terms. Material changes will be communicated via email with
              at least 30 days notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Contact</h2>
            <p>
              Questions? Email{' '}
              <a href="mailto:legal@virtualprosnetwork.com" className="font-semibold text-primary">
                legal@virtualprosnetwork.com
              </a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
