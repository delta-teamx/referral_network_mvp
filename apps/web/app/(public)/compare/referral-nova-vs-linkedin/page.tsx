import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'Referral Nova vs LinkedIn: The Best Alternative for Business Referrals',
  description:
    'LinkedIn is a social network for connections. Referral Nova is an AI-powered referral network that turns relationships into qualified business introductions. Here is how they differ.',
  alternates: { canonical: '/compare/referral-nova-vs-linkedin' },
};

const faqs = [
  {
    q: 'Is Referral Nova a replacement for LinkedIn?',
    a: 'Not exactly. LinkedIn is for building a professional profile and a broad network of connections. Referral Nova is for generating qualified business referrals - it uses AI to match you with trusted partners who can actually send you clients, and to send referrals back to them. Many businesses use both, but rely on Referral Nova for revenue-driving introductions.',
  },
  {
    q: 'What is the best alternative to LinkedIn for business referrals?',
    a: 'Referral Nova is purpose-built for referrals rather than social connections. Instead of collecting contacts, its AI matching engine pairs your business with complementary partners so warm, two-way referrals flow automatically.',
  },
  {
    q: 'How is an AI referral network different from LinkedIn networking?',
    a: 'On LinkedIn you find people and hope a relationship forms. An AI referral network like Referral Nova analyzes what each business does and who it serves, then proactively suggests high-fit introductions and tracks the referrals that result - so networking produces measurable revenue.',
  },
  {
    q: 'Does Referral Nova cost less than LinkedIn Premium?',
    a: 'Referral Nova has a free plan and paid tiers focused on referral volume and AI matching. See the pricing page for current plans. The value is measured in referrals received, not profile views.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="Comparison"
      title="Referral Nova vs LinkedIn"
      intro="LinkedIn helps you collect connections. Referral Nova helps you get referrals. Here is the practical difference for a business owner who wants qualified introductions, not just a bigger contact list."
      faqs={faqs}
      cta="Try the referral-first alternative to LinkedIn"
    >
      <section>
        <h2>The core difference: connections vs referrals</h2>
        <p>
          LinkedIn is a social network. Its job is to help you build a profile and accumulate
          connections. What happens after you connect is up to you - most connections never turn into
          business.
        </p>
        <p>
          Referral Nova is a referral network. Its job is to turn relationships into qualified
          business introductions. An AI matching engine studies what your business does and who it
          serves, then pairs you with trusted, complementary partners so referrals flow both ways.
        </p>
      </section>

      <section>
        <h2>Side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-4 font-semibold text-gray-500">&nbsp;</th>
                <th className="py-2 pr-4 font-semibold text-gray-900">LinkedIn</th>
                <th className="py-2 font-semibold text-primary">Referral Nova</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-gray-100 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top [&_td]:text-gray-700">
              <tr>
                <td className="font-medium text-gray-900">Primary goal</td>
                <td>Build a network of connections</td>
                <td>Generate qualified referrals</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">How matches happen</td>
                <td>You search and add people</td>
                <td>AI proactively matches high-fit partners</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Outcome tracked</td>
                <td>Profile views, connections</td>
                <td>Referrals sent, received and won</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Relationship model</td>
                <td>One-directional following</td>
                <td>Two-way, give-and-get referrals</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Best for</td>
                <td>Personal brand and recruiting</td>
                <td>Service businesses that grow by referral</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Why referrals outperform cold outreach</h2>
        <p>
          A referred prospect arrives with trust already transferred from the person who introduced
          them. They close faster, spend more, and churn less than a cold lead. LinkedIn is built for
          reach; Referral Nova is built for trust - it concentrates on the small number of
          introductions that actually turn into revenue.
        </p>
      </section>

      <section>
        <h2>When to use each</h2>
        <ul className="list-disc pl-5">
          <li>Use LinkedIn to publish content, build a personal brand, and recruit.</li>
          <li>Use Referral Nova to be matched with partners who send you clients - and to reliably send referrals back.</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
