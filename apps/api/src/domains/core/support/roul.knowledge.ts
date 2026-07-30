/**
 * ROUL knowledge base.
 *
 * Curated, authoritative facts about Referral Nova that ground ROUL's answers.
 * The KB is small enough to inject directly into context (far more accurate than
 * chunk retrieval at this size, and no vector infra to drift). When it outgrows
 * the model context we swap this for a pgvector retrieval layer behind the same
 * `getKnowledge()` call - the service doesn't change.
 *
 * Keep this in sync with the website. Edit here, redeploy - no other change.
 */

export const KNOWLEDGE_VERSION = '2026-07-30';

export function getKnowledge(): string {
  return KB.trim();
}

const KB = `
# Referral Nova — product knowledge

## What it is
Referral Nova is an AI-powered referral network for businesses. Its AI matches members with trusted partners so qualified referrals flow in both directions, continuously. Marketing site: referralnova.com. App: dashboard.referralnova.com.

## How it works (4 steps)
1. Build your profile (business, industry, who you want to meet, who you can refer).
2. Record a 60-second intro video (optional but boosts matches; it is transcribed and used for matching).
3. The AI suggests introductions ("intros") to relevant members.
4. You meet over Zoom, exchange referrals, and can sign referral agreements on-platform.

## Onboarding / profile setup
- Sign up at dashboard.referralnova.com/signup (Google or email; no credit card).
- Complete onboarding: business name, industry, headline, services, who you want to meet, who you can refer, city/state, optional photo and website and LinkedIn.
- A profile photo is required to join. Photos are compressed automatically; JPG/PNG/WebP and iPhone photos all work.
- The 60-second intro video is optional; members send far more referrals to people they can see and hear.

## Matching, intros, messaging
- The AI ranks matches on industry alignment, referral compatibility, keyword overlap, and location.
- You send an "intro request"; the other member accepts to open a conversation.
- Messaging is in-app. Free members can send up to 3 intro requests and start up to 3 conversations, then must upgrade to Pro to reach more people. Existing conversations stay open.

## Zoom bookings
- Book a call from a member's profile; the host accepts, then a Zoom link is provisioned.
- Availability and times are shown in US Eastern time.

## Referral agreements / contracts
- Members can create, send, and sign referral agreements electronically on-platform.
- Signing is legally an electronic signature. Referral Nova is not a party to member-to-member agreements.
- Signed agreements are viewable and exportable from your dashboard.

## Trust Score
- Every business has a 0–10 Trust Score, updated nightly. Factors: verified identity, reviews, referrals converted, response time, years active, network endorsements. No pay-to-win.

## Plans & billing
- FREE: 3 leads/month, 1 listing, join up to 2 groups, 3 intro requests + 3 conversations.
- PRO ($49/mo): 30 leads/month, 3 listings, 10 groups, unlimited intros/conversations, ranking detail.
- PREMIUM ($149/mo): unlimited leads, 10 listings, unlimited groups, priority ranking.
- Billing is via Stripe; cancel anytime, effective at period end; no prorated refunds.

## Founding offer
- The first 200 qualifying BUSINESS accounts get lifetime Premium free. Consumers do not consume a founding spot. Terms: referralnova.com/terms#founding-offer.

## Groups & events
- Groups are BNI-style local circles with a fixed roster (one seat per category).
- Events are live Zoom networking sessions; register to get the link by email.

## Invite & earn
- Every member has a personal invite link (referralnova.com/join/<code>). Successful invites earn leaderboard points and, for non-founding members, free Premium months.

## Support
- Support is online 24/7. ROUL (AI Support Manager) is first responder; a human can take over the same thread. Escalations for unresolved onboarding issues go to the technical team.

## Common fixes
- Photo won't upload: it's auto-compressed; if it still fails, try a JPG under 40MB or a different browser.
- Images/video slow: served from storage directly; a hard refresh usually clears a stale cache.
- Can't send new messages on Free: you've used your 3 free conversations/intros — upgrade to Pro to reach more members.
- Login issues: use dashboard.referralnova.com/login; reset via "Forgot password".
`;
