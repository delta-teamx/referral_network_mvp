export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 mb-2 text-4xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: April 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Information we collect</h2>
            <p>
              When you create an account, we collect your name, email address, business
              information, and optionally a video introduction and profile photo. We also
              collect data you voluntarily provide in your &ldquo;who I want to meet&rdquo; and &ldquo;who I
              can refer&rdquo; fields.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. How we use your information</h2>
            <ul className="list-disc pl-6">
              <li>To match you with other members via our AI engine.</li>
              <li>To facilitate introductions, bookings, and Zoom meetings.</li>
              <li>To send you transactional emails (booking confirmations, referral alerts).</li>
              <li>To improve our matching algorithm over time.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">3. Information sharing</h2>
            <p>
              We do not sell your personal data. Your public profile (name, business info,
              video) is visible to other logged-in members. We share booking details only with
              the two parties involved in a call. We use third-party services (SendGrid for
              email, Twilio for SMS, Zoom for meetings, Stripe for payments) to deliver
              platform functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">4. Your rights</h2>
            <p>
              You can update or delete your profile at any time from your dashboard settings.
              You can request a full export or deletion of your data by emailing{' '}
              <a href="mailto:privacy@referralnova.com" className="font-semibold text-primary">
                privacy@referralnova.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">5. Cookies</h2>
            <p>
              We use an HTTP-only refresh token cookie to keep you logged in across sessions.
              This cookie is not used for tracking or advertising.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Contact</h2>
            <p>
              Questions about this policy? Email{' '}
              <a href="mailto:privacy@referralnova.com" className="font-semibold text-primary">
                privacy@referralnova.com
              </a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
