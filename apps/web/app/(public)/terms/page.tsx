export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Legal</p>
        <h1 className="mt-2 mb-2 text-4xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: July 2026</p>

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

          <section id="founding-offer">
            <h2 className="text-2xl font-bold text-gray-900">5. Founding member offer</h2>
            <p>
              The first 200 qualifying business accounts to complete registration receive the
              &ldquo;Founding Member&rdquo; benefit: access to the Premium plan at no charge for the life
              of the account. The following applies to that benefit:
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Qualification.</strong> Eligibility is determined by the order in which
                business accounts complete registration, as recorded by our systems. One
                Founding Member benefit per business.
              </li>
              <li>
                <strong>Duration.</strong> &ldquo;Lifetime&rdquo; means for as long as Referral Nova
                operates the service and your account remains open and in good standing. No
                recurring payment is ever required for the benefit.
              </li>
              <li>
                <strong>Scope.</strong> The benefit covers the features of the Premium
                subscription tier as it exists and evolves. If we rename or restructure our
                plans, Founding Members receive the closest equivalent tier. Optional paid
                add-ons and third-party costs are not included.
              </li>
              <li>
                <strong>Transfer.</strong> The benefit is tied to the qualifying business
                account and is not transferable or redeemable for cash.
              </li>
              <li>
                <strong>Revocation.</strong> We may revoke the benefit from accounts that
                violate these terms, provide false information, or engage in fraud - the same
                grounds on which any account may be suspended.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">6. Referrals and bookings</h2>
            <p>
              We facilitate introductions but don&rsquo;t guarantee business outcomes. Any
              agreements, deals, or services exchanged between members are solely between
              those members. We are not responsible for disputes or payment issues between
              members.
            </p>
          </section>

          <section id="referral-agreements">
            <h2 className="text-2xl font-bold text-gray-900">7. Referral agreements and e-signatures</h2>
            <p>
              The platform lets members create, send, and sign referral agreements with each
              other electronically. By clicking to sign an agreement on the platform, you
              consent to transact electronically and agree that your electronic signature is
              the legal equivalent of a handwritten signature.
            </p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Between members only.</strong> Referral Nova is not a party to any
                agreement created between members, does not provide legal advice, and does not
                guarantee that any template or agreement is enforceable or suitable for your
                situation. Consult your own counsel before signing.
              </li>
              <li>
                <strong>Disputes.</strong> Commissions, payments, and performance under a
                member-to-member agreement are solely between the members involved. Governing
                law for such agreements is whatever the members choose in the agreement itself.
              </li>
              <li>
                <strong>Visibility.</strong> Agreements are visible to the members who are
                party to them. Where a group administrator manages your networking group,
                summary contract activity may also be visible to that administrator.
              </li>
              <li>
                <strong>Records.</strong> We retain signed agreements while the associated
                accounts remain open, and you can view and export your agreements from your
                dashboard. Deleting your account does not void agreements you already signed.
              </li>
              <li>
                <strong>Compliance.</strong> You are responsible for ensuring referral
                arrangements and any compensation comply with the laws and licensing rules of
                your industry and jurisdiction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">8. Content</h2>
            <p>
              You own the content you upload (video intros, descriptions, photos). By
              uploading, you grant us a non-exclusive license to display it to other members.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">9. Termination</h2>
            <p>
              We may suspend or terminate your account for violations of these terms. You may
              delete your account at any time from your dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">10. Changes</h2>
            <p>
              We may update these terms. Material changes will be communicated via email with
              at least 30 days notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900">11. Contact</h2>
            <p>
              Questions? Email{' '}
              <a href="mailto:legal@referralnova.com" className="font-semibold text-primary">
                legal@referralnova.com
              </a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
