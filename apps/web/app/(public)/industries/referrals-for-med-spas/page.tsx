import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'Referral Network for Med Spas | Get Provider & Partner Referrals',
  description:
    'Referral Nova matches med spas with dermatologists, salons, wellness providers and local businesses who send high-value client referrals - and tracks every one. Grow with warm referrals, not just ads.',
  alternates: { canonical: '/industries/referrals-for-med-spas' },
};

const faqs = [
  {
    q: 'How do med spas get more client referrals?',
    a: 'Med spas grow fastest through referrals from complementary providers - dermatologists, plastic surgeons, salons, gyms, and wellness practitioners - plus happy clients. Referral Nova matches you with those partners using AI and tracks the referrals both ways, so growth is not dependent on ad spend alone.',
  },
  {
    q: 'What is the best referral partner for a med spa?',
    a: 'The best referral partners for a med spa are businesses that already serve your ideal client and do not compete with your core services: dermatology and plastic surgery practices, hair salons, fitness studios, and wellness providers. Referral Nova finds and matches those partners for you.',
  },
  {
    q: 'Can med spas track where referrals come from?',
    a: 'Yes. Referral Nova tracks each referral from the partner who sent it through to a booked, paying client, so you know which relationships actually drive revenue.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="For med spas & wellness"
      title="A referral network built for med spas"
      intro="Med spas grow on trust and word of mouth. Referral Nova uses AI to match you with the dermatologists, salons, and wellness partners who send high-value clients - and tracks every referral, so growth is not left to ad spend."
      faqs={faqs}
      cta="Grow your med spa on referrals"
    >
      <section>
        <h2>Who this is for</h2>
        <p>
          Med spa owners and aesthetic practices that want a dependable stream of high-value client
          referrals from complementary providers and local businesses.
        </p>
      </section>
      <section>
        <h2>The problem</h2>
        <p>
          Many med spas lean heavily on paid ads with rising costs and thin loyalty. The
          relationships that send the best clients - dermatology practices, salons, wellness studios -
          are underdeveloped and untracked.
        </p>
      </section>
      <section>
        <h2>How Referral Nova helps</h2>
        <ul className="list-disc pl-5">
          <li>AI matches you with dermatologists, salons, fitness studios, and wellness providers.</li>
          <li>Warm introductions build trusted, two-way referral relationships.</li>
          <li>Every referral is tracked from partner to booked, paying client.</li>
          <li>Reduce dependence on paid ads with a compounding referral engine.</li>
        </ul>
      </section>
      <section>
        <h2>What results to expect</h2>
        <p>
          A steadier flow of pre-qualified, high-value clients; stronger partnerships with local
          providers; and growth that is not hostage to ad costs.
        </p>
      </section>
    </ArticleLayout>
  );
}
