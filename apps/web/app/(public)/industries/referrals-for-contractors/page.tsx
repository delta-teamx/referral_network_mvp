import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'Referral Network for Contractors | Get Trade & Realtor Referrals',
  description:
    'Referral Nova matches contractors with realtors, property managers, designers and complementary trades who send steady referral work - and tracks every job. Fill your pipeline with warm leads, not cold bids.',
  alternates: { canonical: '/industries/referrals-for-contractors' },
};

const faqs = [
  {
    q: 'How do contractors get more referral work?',
    a: 'Contractors win the most repeat work from a network of realtors, property managers, designers, and complementary trades. Referral Nova matches you with those partners using AI and tracks the referrals both ways, so your schedule fills with warm jobs instead of low-margin cold bids.',
  },
  {
    q: 'What is the best way for contractors to network for leads?',
    a: 'The highest-ROI networking for contractors is building trusted referral relationships with the people who already talk to homeowners - agents, property managers, and other trades. Referral Nova makes those matches automatically and keeps the referrals organized.',
  },
  {
    q: 'Can trades refer jobs to each other on Referral Nova?',
    a: 'Yes. Complementary trades (a plumber and an electrician, a roofer and a general contractor) refer overflow and adjacent work constantly. Referral Nova matches complementary trades and records every referral.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="For contractors & trades"
      title="A referral network built for contractors"
      intro="The best contracting jobs come referred - from realtors, property managers, designers, and other trades. Referral Nova uses AI to match you with those partners and tracks every job, so your pipeline fills with warm work instead of cold bids."
      faqs={faqs}
      cta="Fill your schedule with referred work"
    >
      <section>
        <h2>Who this is for</h2>
        <p>
          General contractors, remodelers, and specialty trades (roofing, HVAC, plumbing, electrical,
          landscaping) who want a steady pipeline of referred jobs and partners to send overflow work
          to.
        </p>
      </section>
      <section>
        <h2>The problem</h2>
        <p>
          Contractors often compete on price for cold leads from ad platforms. Meanwhile the referral
          relationships that produce the best margins - agents, property managers, adjacent trades -
          are informal and easily lost.
        </p>
      </section>
      <section>
        <h2>How Referral Nova helps</h2>
        <ul className="list-disc pl-5">
          <li>AI matches you with realtors, property managers, designers, and complementary trades.</li>
          <li>Warm introductions mean you bid against trust, not just price.</li>
          <li>Referrals are tracked from introduction through to a won job.</li>
          <li>Send overflow and adjacent work to partners so referrals keep coming back.</li>
        </ul>
      </section>
      <section>
        <h2>What results to expect</h2>
        <p>
          Higher-margin, referred jobs; fewer race-to-the-bottom cold bids; and durable partnerships
          with the people who steer homeowner work.
        </p>
      </section>
    </ArticleLayout>
  );
}
