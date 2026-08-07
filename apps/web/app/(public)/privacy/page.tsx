export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 mb-2 text-4xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: August 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900">1. Information we collect</h2>
            <p>
              When you create an account, we collect your name, email address, business
              information, and optionally a video introduction and profile photo. We also
              collect data you voluntarily provide in your &ldquo;who I want to meet&rdquo; and &ldquo;who I
              can refer&rdquo; fields. If you connect an optional integration such as Google
              Calendar or Zoom, we also process the limited data described in sections 4 and 5.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">2. How we use your information</h2>
            <ul className="list-disc pl-6">
              <li>To match you with other members via our AI engine.</li>
              <li>To facilitate introductions, bookings, and Zoom meetings.</li>
              <li>To send you transactional emails (booking confirmations, referral alerts).</li>
              <li>
                To improve our own matching algorithm over time. We never use data from
                connected Google services to train or improve any AI/ML models &mdash; see
                sections 4 and 6.
              </li>
            </ul>
          </section>

          <section id="ai-processing">
            <h2 className="text-2xl font-bold text-gray-900">3. Video introductions, transcription, and AI processing</h2>
            <p>
              If you record or upload an optional video introduction, here is exactly what
              happens to it:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Transcription.</strong> The audio in your video is automatically
                transcribed to text using speech-to-text technology, which may be provided by
                third-party AI service providers acting on our behalf.
              </li>
              <li>
                <strong>Indexing for matching.</strong> The transcript - together with your
                profile fields (business info, &ldquo;who I want to meet,&rdquo; &ldquo;who I can
                refer&rdquo;) - is indexed and processed by our AI matching engine to suggest
                relevant introductions. It is used only to power matching and search inside the
                platform.
              </li>
              <li>
                <strong>Third-party AI providers.</strong> Our AI features (profile matching and
                the in-app support assistant) are powered by third-party AI services accessed
                through their APIs. We send them only the profile and support content needed to
                provide the feature, under API terms that do not permit them to use our data to
                train or improve their own models. We never send data obtained from Google APIs
                (see section 4) to any AI service.
              </li>
              <li>
                <strong>Visibility.</strong> Your video is shown to other logged-in members as
                part of your profile. Transcripts are used internally for matching and are not
                published as a separate public document.
              </li>
              <li>
                <strong>Retention.</strong> We keep your video and its transcript while your
                account is active or until you replace or delete the video. Deleting your video
                from profile settings also removes its transcript from matching, and deleting
                your account removes both.
              </li>
              <li>
                <strong>Model training.</strong> We use your content to generate your matches -
                we do not sell it or permit our AI providers to use it to train their own
                models beyond providing the service to us.
              </li>
              <li>
                <strong>Your controls.</strong> The video is optional. You can record, replace,
                or delete it at any time from your dashboard settings, or email us for full
                deletion.
              </li>
            </ul>
          </section>

          <section id="google-user-data">
            <h2 className="text-2xl font-bold text-gray-900">4. Google Calendar and Google user data</h2>
            <p>
              Connecting your Google Calendar is optional. If you choose to connect it, Referral
              Nova requests only the minimum access needed to schedule your calls:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>
                  <code>calendar.events</code>
                </strong>{' '}
                &mdash; to add a calendar event when you confirm a Referral Nova call, and to
                update or remove that event if the call is rescheduled or canceled. We only
                create, update, and delete the events that Referral Nova itself adds for your
                bookings.
              </li>
              <li>
                <strong>
                  <code>calendar.freebusy</code>
                </strong>{' '}
                &mdash; to read only your busy/free time intervals (start and end times) so we
                never offer a booking slot when you are already busy. This scope returns only
                busy intervals; it does <strong>not</strong> give us the titles, attendees,
                descriptions, locations, or any other content of your calendar events.
              </li>
            </ul>
            <p>
              We access this data solely to provide the scheduling feature to you, at your
              request. You can disconnect Google Calendar at any time from your dashboard
              settings, or revoke access from your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="font-semibold text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Account permissions page
              </a>
              . Disconnecting stops all further access and deletes the authorization tokens we
              stored for your account.
            </p>
            <p>
              <strong>Limited Use.</strong> Referral Nova&rsquo;s use and transfer of information
              received from Google APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="font-semibold text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p>
              <strong>No AI training on Google data.</strong> We do not use any data obtained
              through Google APIs &mdash; whether raw, aggregated, or derived &mdash; to develop,
              train, or improve any generalized or foundational artificial-intelligence or
              machine-learning models, and we do not transfer Google user data to any
              third-party AI/ML service. Your Google Calendar data is used only to power your
              bookings inside Referral Nova; it is never sent to our AI matching engine or to any
              AI provider.
            </p>
          </section>

          <section id="data-protection">
            <h2 className="text-2xl font-bold text-gray-900">5. How we protect your data</h2>
            <p>
              We apply safeguards appropriate to the sensitivity of the data we hold, including
              any sensitive data obtained from connected services:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Encryption in transit.</strong> All traffic between your browser, our
                application, and the services we rely on is encrypted using TLS/HTTPS.
              </li>
              <li>
                <strong>Encryption at rest.</strong> Your data is stored in managed databases and
                object storage that encrypt data at rest.
              </li>
              <li>
                <strong>Access controls.</strong> Access to production data is restricted to
                authorized personnel on a need-to-know basis and protected by authentication.
                Every API request is authenticated and authorized per user, so members can only
                reach their own data.
              </li>
              <li>
                <strong>OAuth tokens.</strong> Authorization tokens for connected services (such
                as Google Calendar and Zoom) are stored securely, used only to provide the
                features you enabled, and deleted when you disconnect the service or delete your
                account.
              </li>
              <li>
                <strong>Retention and deletion.</strong> We keep personal and sensitive data only
                while your account is active or as needed to provide the service, then delete or
                anonymize it. You can delete your profile, disconnect integrations, or request
                full deletion at any time (see section 7).
              </li>
            </ul>
            <p>
              No method of transmission or storage is completely secure, but we work to protect
              your information using industry-standard practices and to limit access to it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Information sharing</h2>
            <p>
              We do not sell your personal data. Your public profile (name, business info,
              video) is visible to other logged-in members. We share booking details only with
              the two parties involved in a call. We use third-party services (SendGrid for
              email, Twilio for SMS, Zoom for meetings, Stripe for payments, and third-party AI
              providers for matching and support) to deliver platform functionality; each
              receives only the data needed for its function. As stated in section 4, data
              obtained from Google APIs is never shared with any AI provider.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">7. Your rights</h2>
            <p>
              You can update or delete your profile at any time from your dashboard settings.
              You can request a full export or deletion of your data by emailing{' '}
              <a href="mailto:privacy@referralnova.com" className="font-semibold text-primary">
                privacy@referralnova.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Cookies</h2>
            <p>
              We use an HTTP-only refresh token cookie to keep you logged in across sessions.
              This cookie is not used for tracking or advertising.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Contact</h2>
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
