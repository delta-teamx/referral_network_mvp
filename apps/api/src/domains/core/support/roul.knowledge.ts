/**
 * ROUL knowledge base.
 *
 * Curated, authoritative facts about Referral Nova that ground ROUL's answers.
 * On boot this KB is chunked (one chunk per "## section"), embedded, and stored
 * in the pgvector KnowledgeChunk table; ROUL retrieves the most relevant chunks
 * per question. Editing here + bumping KNOWLEDGE_VERSION re-syncs the store on
 * the next deploy. Admins can also add/edit knowledge live from the ROUL console
 * (Knowledge tab) with no deploy.
 *
 * Keep this in sync with the product. Write plain facts; ROUL turns them into
 * short, warm replies.
 */

export const KNOWLEDGE_VERSION = '2026-08-04c';

export function getKnowledge(): string {
  return KB.trim();
}

const KB = `
# Referral Nova — product knowledge

## What Referral Nova is
Referral Nova is an AI-powered referral network for businesses. Its AI matches members with trusted, complementary partners so qualified referrals flow both ways, continuously. It is not social media - it is built to produce real business introductions and closed referrals. Marketing site: referralnova.com. App: dashboard.referralnova.com.

## The core flow (how it works end to end)
1. Build your profile: your business, industry, what you offer, and who you want to meet (your ideal customer profile).
2. Optionally record a 60-second intro video - it is transcribed and boosts match quality.
3. The AI suggests introductions ("intros") to relevant members.
4. You send or accept an intro request, which opens a direct conversation.
5. You meet over Zoom, exchange referrals, and can sign referral agreements on-platform.
6. Your pipeline and analytics track every lead from introduction to closed deal.

## Signing up
Sign up at dashboard.referralnova.com/signup with Google or email. No credit card is needed to start. After signing up you complete a short onboarding, then land in your dashboard.

## Onboarding steps
Onboarding captures the essentials the matching engine needs: business name, industry, a headline, the services you offer, who you want to meet and who you can refer, and your city/state. A profile photo is required to join. You can add a website, LinkedIn, and a 60-second intro video. Onboarding is considered complete once these core steps are saved.

## Building your profile
Edit your profile any time from Profile settings in the dashboard. The fields that matter most for matching are: your industry and services offered (what you do), and your ideal-customer profile - the industries, roles, and problems of the people you want to be introduced to. The more complete and specific these are, the better your matches. Add a photo and a short intro video to earn more referrals.

## Why your profile matters for matching
The AI builds your matches from your profile - especially your services and your ideal-customer profile. If those are empty or thin, the engine has little to match on and you will see few or no suggestions. Completing your profile is the single biggest lever on match quantity and quality.

## AI suggestions and matches - how they work
The AI ranks potential matches on industry alignment, referral compatibility, keyword and service overlap, and location, and it factors in your intro video transcript when present. Suggestions are generated server-side and refreshed regularly (roughly every few hours), not on demand in your browser. New and updated profiles are picked up on the next refresh, so fresh matches typically appear within about a day of completing your profile.

## AI suggestions or matches are not showing - how to diagnose
Suggestions are generated from your profile, so start there:
1. If onboarding or your profile is incomplete - especially no services listed or no ideal-customer profile set - that is why there are no matches. Completing your profile in Profile settings is what generates them; they appear within about a day.
2. If your profile is complete but your account is only a day or two old, matches refresh every few hours and will populate shortly - it is normal to start empty.
3. If your profile is complete and your account is several days old but still shows zero suggestions, that is a genuine issue on our side and should be escalated to the team.
4. Browser refreshes, cache clearing, or switching browsers do not create suggestions - the data is generated on our servers, not in the browser. Only escalate technical display bugs when suggestions exist but will not appear.

## Sending and accepting intro requests
When the AI suggests someone, you send an "intro request"; the other member accepts it to open a conversation. You can also receive requests - accept them from your Leads inbox or dashboard. Accepting creates a direct conversation and adds the person to your network.

## Messaging
Messaging is in-app and real-time: new messages, read receipts, and typing indicators appear live. You can send emojis and attach files. Every conversation is also a lead, so it shows up in your pipeline. Open Messages from the sidebar.

## Messaging limits by plan
Free members can send up to 3 intro requests and start up to 3 conversations, then must upgrade to Pro to reach more people. Existing conversations always stay open. Pro and Premium have unlimited intros and conversations.

## Attachments in chat
You can attach documents, contracts, and images (PDF, Word, Excel, images) directly in a conversation. Files upload through our own service and open with a link in the thread.

## Booking a Zoom call
Book a call from a member's profile. The host accepts the request, and a Zoom link is then provisioned automatically. You will see the call in your Bookings/Calendar and get a reminder in the notification bell before it starts.

## Availability and time zones
Availability and meeting times are shown in US Eastern time. Set your available windows so others can book you.

## Calendar
Your Calendar shows upcoming and past Zoom calls in one place. You can connect your Google Calendar from the Bookings page ("Connect Google Calendar").

## Google Calendar sync
Connect your Google Calendar from the Bookings page. Once connected, two things happen automatically: (1) your real Google Calendar busy times block out your Referral Nova availability, so nobody can book you over a meeting you already have; and (2) every confirmed call is added to your Google Calendar as an event with the join link, and removed if the call is canceled. It uses read-only free/busy plus event create - Referral Nova never reads the details of your other events. Disconnect anytime from the same button; a member on Google's free plan can still connect. If the connect screen does not return you to Bookings, make sure you allow calendar access when Google asks.

## Referral agreements and contracts
Members can create, send, and sign referral agreements electronically on-platform. Signing is a legal electronic signature. Referral Nova is not a party to member-to-member agreements. Signed agreements are viewable and exportable from your dashboard. You can share a contract inside a conversation and sign one you receive.

## Your pipeline
Every lead and conversation flows into your pipeline - a simple board that tracks each opportunity from first contact to closed deal. Your analytics read straight from it.

## Pipeline stages
The stages are: New, In process, Zoom booked, Follow up, Signing contract, Won (a signed contract is a won deal), plus Lost and Dead for opportunities that did not close. Move cards across stages as the deal progresses.

## Analytics
Analytics reports your real activity and pipeline: leads, conversations, meetings, and won deals, drawn directly from your pipeline stages.

## Groups
Groups are BNI-style local circles with a fixed roster - typically one seat per business category so members are complementary, not competing. Some groups are open to join; others are invite-only or require approval.

## Networking events
Events are live Zoom networking sessions. Register for an event to get the join link by email.

## Leaderboard
The leaderboard ranks members by activity and successful invites, in monthly cycles with an all-time view. It rewards the members who contribute most to the network.

## Invite and earn
Every member has a personal invite link (referralnova.com/join/YOUR-CODE). Successful invites earn leaderboard points and, for non-founding members, free Premium months. There is a ready-made invite message with a one-tap copy button.

## Rewards store
You can spend Contribution points in the Rewards store on temporary unlocks (for example Premium days). Redemptions have an expiry.

## Contribution Score
Contribution Score is a verified points ledger that reflects the real value you add - giving quality referrals and helping the network. It is separate from the live leaderboard activity points and only counts verified contributions. There is no pay-to-win.

## Trust Score
Every business has a 0 to 10 Trust Score, updated nightly. Factors include verified identity, reviews, referrals converted, response time, years active, and network endorsements. It cannot be bought.

## Plans and pricing
FREE: 3 leads per month, 1 listing, join up to 2 groups, 3 intro requests and 3 conversations. PRO ($49/mo): 30 leads per month, 3 listings, 10 groups, unlimited intros and conversations, and ranking detail. PREMIUM ($149/mo): unlimited leads, 10 listings, unlimited groups, and priority ranking.

## Billing and cancellation
Billing is handled by Stripe. You can cancel anytime; cancellation takes effect at the end of the current period, and there are no prorated refunds. Manage your plan from the Billing page.

## Founding offer
The first 200 qualifying business accounts get lifetime Premium free. Consumer accounts do not use a founding spot. Terms: referralnova.com/terms#founding-offer.

## Announcements from the team
The Referral Nova team (for example the Founder) can send announcements to all members. An announcement arrives in your Messages inbox as a pinned "Referral Nova" thread marked "Announcement", and is also emailed to you. Announcements are one-way - you cannot reply to them, and they are not support tickets. They are visible on every plan.

## Notifications and the bell
The notification bell updates in real time - it rings with a sound and shows a badge when something happens (a new message, an intro request, a booking, or a message from the team). You can mute the sound from the bell. Zoom call reminders also appear here.

## Digest and weekly emails
If you are away, we batch your unread messages and intro requests into a single digest email instead of one email per event. There is also a weekly Monday summary of what needs your attention. Active members who see things in-app do not get the extra emails.

## Tutorials
There is a Tutorials tab in the dashboard with short walkthrough videos - start with the intro video, then feature-specific ones like the pipeline. The main intro video is also on the homepage.

## Profile photo and video uploads
A profile photo is required to join. Photos are compressed automatically; JPG, PNG, WebP, and iPhone photos all work. The optional 60-second intro video boosts matches. Uploads go through our service, so there is no separate storage setup for you.

## Login and password
Log in at dashboard.referralnova.com/login. If you cannot get in, use "Forgot password" to reset. Sessions can be refreshed by logging out and back in.

## Common technical issues
Photo will not upload: it is auto-compressed; if it still fails, try a JPG under 40MB or a different browser. Images or video load slowly or look broken: a hard refresh usually clears a stale cache. Cannot send new messages on Free: you have used your 3 free conversations or intros - upgrade to Pro to reach more members. Login issues: reset via "Forgot password". These are the only issues a browser refresh helps with - data problems like missing suggestions are server-side and are not fixed by refreshing.

## What ROUL can and cannot do
ROUL (the AI Support Manager) can explain how the product works, diagnose account-specific situations using the member's account context, and walk members through fixes. ROUL cannot change a member's account, edit their billing, or alter data. When something needs a real change on our side or is genuinely broken, ROUL brings in the human team.
`;
