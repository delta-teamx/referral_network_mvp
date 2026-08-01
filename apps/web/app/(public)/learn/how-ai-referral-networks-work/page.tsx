import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'How AI Referral Networks Work (And Why They Beat Cold Outreach)',
  description:
    'An AI referral network matches businesses that can refer each other and tracks the referrals that result. Here is how AI referral matching works, step by step, and why it produces better leads than cold outreach.',
  alternates: { canonical: '/learn/how-ai-referral-networks-work' },
};

const faqs = [
  {
    q: 'What is an AI referral network?',
    a: 'An AI referral network is a platform that uses artificial intelligence to match businesses that can send each other qualified referrals. Instead of you searching for partners, the AI analyzes what each business does and who it serves, recommends high-fit partners, and tracks the referrals exchanged.',
  },
  {
    q: 'How does AI referral matching work?',
    a: 'The AI builds a profile of each business - industry, services, ideal customer, and location - then scores potential partnerships on how well they complement each other and how likely they are to refer. High-scoring matches are surfaced as suggested introductions, and the resulting referrals are tracked automatically.',
  },
  {
    q: 'Why do referrals outperform cold outreach?',
    a: 'A referred prospect arrives with trust already transferred from the person who introduced them. Referred leads respond faster, convert at higher rates, and retain longer than cold leads, because the buying decision starts from trust rather than skepticism.',
  },
  {
    q: 'Is Referral Nova an AI referral network?',
    a: 'Yes. Referral Nova is an AI-powered referral network that matches your business with trusted partners, opens warm introductions, and tracks referrals from suggestion through to a won deal.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="Guide"
      title="How AI referral networks work"
      intro="An AI referral network turns networking from a numbers game into a matching problem. Instead of meeting everyone and hoping, the AI finds the businesses most likely to refer you - and tracks the referrals that result. Here is how it works."
      faqs={faqs}
      cta="See an AI referral network in action"
    >
      <section>
        <h2>What is an AI referral network?</h2>
        <p>
          An AI referral network is a platform that uses artificial intelligence to match businesses
          that can send each other qualified referrals, then tracks those referrals from introduction
          to closed deal. It replaces the guesswork of traditional networking with data-driven
          matching.
        </p>
      </section>

      <section>
        <h2>How the matching works, step by step</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Build a business profile.</strong> The AI captures what your business does, who
            your ideal customer is, your industry, and your location.
          </li>
          <li>
            <strong>Score potential partnerships.</strong> It compares your profile against every
            other member and scores how well you complement each other and how likely you are to
            refer business to one another.
          </li>
          <li>
            <strong>Surface high-fit introductions.</strong> The strongest matches are recommended as
            suggested introductions, so you spend time on relationships that can actually produce
            referrals.
          </li>
          <li>
            <strong>Open the conversation.</strong> You accept a match and a warm introduction begins
            - not a cold pitch.
          </li>
          <li>
            <strong>Track the outcome.</strong> Referrals are tracked from suggestion through to a won
            deal, so the network learns and your ROI is measurable.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why referrals beat cold outreach</h2>
        <p>
          Cold outreach starts from zero trust, so most of it is ignored. A referral starts from
          borrowed trust - the prospect already believes you are worth talking to because someone they
          trust introduced you. That is why referred leads respond faster, close more often, and
          churn less.
        </p>
      </section>

      <section>
        <h2>The future of professional networking</h2>
        <p>
          The future of networking is intent-based and AI-matched. Rather than maximizing connection
          counts, platforms will optimize for the quality and outcome of introductions - matching
          businesses that can genuinely refer each other, and measuring the referrals that close.
          Referral Nova is built for exactly that.
        </p>
      </section>
    </ArticleLayout>
  );
}
