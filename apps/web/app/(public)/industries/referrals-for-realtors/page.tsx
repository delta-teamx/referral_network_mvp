import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'Referral Network for Realtors | Get Agent & Vendor Referrals',
  description:
    'Referral Nova matches real estate agents with the lenders, inspectors, contractors and fellow agents who send the most referrals - and tracks every introduction. Build a referral pipeline, not a cold-call list.',
  alternates: { canonical: '/industries/referrals-for-realtors' },
};

const faqs = [
  {
    q: 'How do realtors get more referrals?',
    a: 'The most reliable referrals for real estate agents come from a trusted network of complementary professionals - lenders, home inspectors, contractors, stagers, and out-of-area agents. Referral Nova uses AI to match you with those partners and tracks the referrals that flow both ways, so your pipeline is built on relationships instead of cold outreach.',
  },
  {
    q: 'What is the best referral network for real estate agents?',
    a: 'A good referral network for realtors matches you with the exact partner types that drive home transactions and makes give-and-get referrals easy to track. Referral Nova is built for that: AI matching, warm introductions, and referral tracking from first contact to closed deal.',
  },
  {
    q: 'Can agents refer clients to each other on Referral Nova?',
    a: 'Yes. Agent-to-agent referrals (relocations, out-of-area buyers, price points outside your focus) are a core use case. Referral Nova matches you with agents whose business complements yours and records the referral so nothing falls through the cracks.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="For real estate"
      title="A referral network built for realtors"
      intro="Real estate runs on referrals - from lenders, inspectors, contractors, stagers, and other agents. Referral Nova uses AI to match you with those partners and tracks every introduction, so you build a referral pipeline instead of chasing cold leads."
      faqs={faqs}
      cta="Build your real estate referral pipeline"
    >
      <section>
        <h2>Who this is for</h2>
        <p>
          Real estate agents, brokers, and teams who want a steady flow of qualified referrals from
          the professionals around every transaction - and who want to send referrals back to grow
          those relationships.
        </p>
      </section>
      <section>
        <h2>The problem</h2>
        <p>
          Most agents rely on sporadic word of mouth and cold prospecting. Referral relationships with
          lenders, inspectors, and contractors are informal and untracked, so they fade - and no one
          knows who actually sent what.
        </p>
      </section>
      <section>
        <h2>How Referral Nova helps</h2>
        <ul className="list-disc pl-5">
          <li>AI matches you with lenders, inspectors, contractors, stagers, and complementary agents.</li>
          <li>Warm introductions replace cold calls, so conversations start from trust.</li>
          <li>Every referral is tracked from introduction to closed deal.</li>
          <li>Give-and-get relationships keep your pipeline compounding over time.</li>
        </ul>
      </section>
      <section>
        <h2>What results to expect</h2>
        <p>
          A referral-driven pipeline: more warm introductions, faster closes from pre-trusted
          prospects, and durable partnerships with the professionals who touch every deal.
        </p>
      </section>
    </ArticleLayout>
  );
}
