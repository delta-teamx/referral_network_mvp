export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">About</p>
        <h1 className="mt-2 mb-6 text-4xl font-bold text-gray-900">
          The future of networking is <span className="text-primary">automated</span>.
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700">
          <p className="text-lg leading-relaxed">
            NRG is an AI-powered referral network built on a simple
            observation: the best referrals come from people who <em>know</em> what you do and
            who you want to meet — but in a room of 50 business owners, no one can remember
            everyone&rsquo;s specialty, ideal client, or referral capability.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">The problem with BNI-style groups</h2>
          <p>
            Traditional networking groups run on human memory. You meet 30 people once a week,
            try to remember each person&rsquo;s business, and hope you think of them at the right
            moment when a client needs a roofer, a CPA, or a wedding planner. Referrals fall
            through the cracks. Good introductions never happen.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">Our solution</h2>
          <p>
            We built a platform where each member fills out a structured profile: what they do,
            who their ideal client is, who they can refer business to. An AI engine reads every
            profile and automatically surfaces the best introductions — complete with a reason
            and a one-click way to request a call or join a live networking event.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-gray-900">Two products</h2>
          <ul className="my-4 space-y-2">
            <li>
              <strong>NRG Network</strong> — our own flagship network, open to any
              business owner looking for quality referrals.
            </li>
            <li>
              <strong>White-label for existing groups</strong> — BNI chapters, Chambers of
              Commerce, and mastermind groups can license the AI engine to power their own
              community.
            </li>
          </ul>

          <p className="mt-8 text-sm text-gray-500">
            Questions? <a href="/contact" className="font-semibold text-primary hover:underline">Contact us</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
