import type { Metadata } from 'next';
import { ArticleLayout } from '../../../../components/seo/ArticleLayout';

export const metadata: Metadata = {
  title: 'Referral Nova vs BNI: AI Referrals vs Weekly Chapter Meetings',
  description:
    'BNI runs local chapters with weekly in-person meetings and one seat per profession. Referral Nova is an AI-powered referral network with no mandatory meetings and unlimited reach. Compare the two.',
  alternates: { canonical: '/compare/referral-nova-vs-bni' },
};

const faqs = [
  {
    q: 'What is the difference between Referral Nova and BNI?',
    a: 'BNI is a structured, in-person referral organization built around local chapters, weekly meetings, and a one-member-per-profession rule. Referral Nova is an AI-powered referral network that matches you with trusted partners online, tracks referrals automatically, and has no mandatory weekly meeting. Referral Nova can also power closed groups that run their own live events.',
  },
  {
    q: 'Is Referral Nova a good alternative to BNI?',
    a: 'Yes, especially for businesses that want referral relationships without the time commitment of weekly in-person meetings, or that want to reach partners beyond a single local chapter. Referral Nova uses AI matching to surface high-fit partners and tracks the referrals that result.',
  },
  {
    q: 'Does Referral Nova have meetings like BNI?',
    a: 'Meetings are optional. Groups on Referral Nova (like partner communities) can schedule and announce live Zoom events that members RSVP to, but there is no mandatory weekly attendance requirement to stay in good standing.',
  },
  {
    q: 'Can a networking group run on Referral Nova instead of BNI?',
    a: 'Yes. Referral Nova supports private, closed groups with their own leaders, member approval, announcements, and Zoom events - so an existing referral group can run its entire community on the platform with AI matching built in.',
  },
];

export default function Page() {
  return (
    <ArticleLayout
      eyebrow="Comparison"
      title="Referral Nova vs BNI"
      intro="BNI pioneered structured referral networking with local chapters and weekly meetings. Referral Nova brings the same give-and-get referral philosophy online, adds AI matching, and drops the mandatory weekly commitment."
      faqs={faqs}
      cta="Get referral relationships without the weekly meeting"
    >
      <section>
        <h2>Two takes on the same idea: referrals beat cold leads</h2>
        <p>
          BNI and Referral Nova agree on the fundamentals - the best business comes from trusted
          referrals, and the way to get referrals is to give them. They differ in how the network is
          run.
        </p>
        <p>
          BNI organizes that exchange around local chapters that meet weekly in person, with one seat
          per profession per chapter. Referral Nova organizes it around an AI matching engine that
          pairs complementary businesses, tracks the referrals they exchange, and lets groups meet
          live over Zoom when they choose to.
        </p>
      </section>

      <section>
        <h2>Side by side</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 pr-4 font-semibold text-gray-500">&nbsp;</th>
                <th className="py-2 pr-4 font-semibold text-gray-900">BNI</th>
                <th className="py-2 font-semibold text-primary">Referral Nova</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-gray-100 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top [&_td]:text-gray-700">
              <tr>
                <td className="font-medium text-gray-900">Format</td>
                <td>In-person local chapters</td>
                <td>Online, with optional live Zoom events</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Meetings</td>
                <td>Weekly, mandatory attendance</td>
                <td>Optional, RSVP-based</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Matching</td>
                <td>Manual, within your chapter</td>
                <td>AI matching across the network or your group</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Reach</td>
                <td>One local chapter</td>
                <td>Wider network, or a private closed group</td>
              </tr>
              <tr>
                <td className="font-medium text-gray-900">Referral tracking</td>
                <td>Manual slips</td>
                <td>Built-in, automatic tracking and analytics</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Which should you choose?</h2>
        <ul className="list-disc pl-5">
          <li>Choose BNI if you value structured, face-to-face accountability and a local chapter.</li>
          <li>Choose Referral Nova if you want AI-matched partners, automatic referral tracking, and flexibility on when and how you meet.</li>
          <li>Run both - many members use Referral Nova to extend their referral relationships beyond a single chapter.</li>
        </ul>
      </section>
    </ArticleLayout>
  );
}
