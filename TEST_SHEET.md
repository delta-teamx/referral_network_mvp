
# VirtualProsNetwork — Production Test Sheet
## Date: ___________  Tester: ___________

---

## 1. PUBLIC WEBSITE (referralnova.com)

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 1.1 | Open referralnova.com | Homepage loads with Referral Nova branding | | |
| 1.2 | Click each nav link (How It Works, For Members, For Groups, Events, Pricing) | Each page loads correctly | | |
| 1.3 | Click "Live Demo" button | /demo page opens with 6 interactive tabs | | |
| 1.4 | Click through all 6 demo tabs | Overview, AI, Analytics, Bookings, Network, Messages all render | | |
| 1.5 | Wait 5 seconds on homepage | Signup popup appears | | |
| 1.6 | Dismiss popup | Popup doesn't reappear (session) | | |
| 1.7 | Bottom signup banner visible | "Join VirtualProsNetwork" with signup button | | |
| 1.8 | Click "Join free" | Redirects to virtualprosnetwork.com/signup | | |
| 1.9 | Click Referral Nova logo | Stays on referralnova.com | | |
| 1.10 | Footer shows Referral Nova branding | Logo + "Powering VirtualProsNetwork" | | |
| 1.11 | Footer links work (Privacy, Terms, Contact, About) | Each page loads | | |
| 1.12 | Tab title shows "Referral Nova" | Check browser tab | | |
| 1.13 | Favicon is nova star icon | Check browser tab | | |

---

## 2. SIGNUP FLOW (virtualprosnetwork.com)

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 2.1 | Open virtualprosnetwork.com | Redirects to /login | | |
| 2.2 | Click "Create free account" | Signup page loads | | |
| 2.3 | Logo shows VirtualPros (not Referral Nova) | Check header | | |
| 2.4 | No popup or bottom banner | Hidden on VPN domain | | |
| 2.5 | Submit empty form | Validation errors shown | | |
| 2.6 | Submit with weak password (no uppercase) | Password error shown | | |
| 2.7 | Submit with valid data | Account created, redirects to /verify-otp | | |
| 2.8 | OTP page shows email address | "We sent a code to your@email.com" | | |
| 2.9 | Check email inbox | 6-digit code received from virtualprosnetwork.com | | |
| 2.10 | Enter wrong code | "Incorrect code" error | | |
| 2.11 | Click "Resend" | "New code sent" confirmation | | |
| 2.12 | Enter correct code | "Email verified!" → redirects to /onboarding | | |
| 2.13 | Try signup with same email again | "Email already exists" + "Log in instead" link | | |
| 2.14 | Try signup with disposable email (mailinator.com) | Rejected | | |

---

## 3. GOOGLE OAUTH

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 3.1 | Click "Continue with Google" on signup | Google account picker opens | | |
| 3.2 | Select Google account (new user) | Redirected to /onboarding | | |
| 3.3 | Click "Continue with Google" on login (existing user) | Redirected to /dashboard | | |
| 3.4 | No "Invalid OAuth state" error | Clean redirect | | |
| 3.5 | No demo mode popup | Real Google flow | | |

---

## 4. ONBOARDING (7 Steps)

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 4.1 | Step 1 (Basics): Enter ZIP, select category, pick goals | "Save & continue" works | | |
| 4.2 | Step 1: Skip ZIP | Error: "Please enter a valid 5-digit ZIP" | | |
| 4.3 | Step 1: Skip category | Error: "Please select your primary category" | | |
| 4.4 | Step 1: Skip goals | Error: "Please select at least one goal" | | |
| 4.5 | Step 2 (Business): Enter business name, industry | Next works | | |
| 4.6 | Step 2: Service area radio buttons | Local/Remote/International selectable | | |
| 4.7 | Step 2: Local shows radius field | Radius input appears | | |
| 4.8 | Step 2: Required fields marked with * | ZIP, category, business name, industry | | |
| 4.9 | Step 3 (ICP): Select industries, roles | Next works | | |
| 4.10 | Step 4 (Referrals): Select industries | Next works | | |
| 4.11 | Step 5 (Barter): Toggle checkbox, fill offerings | "Save & continue" works | | |
| 4.12 | Step 6 (Video): "Open camera" button | Camera permission prompt | | |
| 4.13 | Step 6: Camera preview visible (not black) | Live feed shown | | |
| 4.14 | Step 6: Record → timer counts → Stop | Video plays back | | |
| 4.15 | Step 6: "Use this video" uploads | Upload progress shown | | |
| 4.16 | Step 6: "Skip for now" | Skips to done step | | |
| 4.17 | Step 6: Business photo upload | Click to upload, preview shows | | |
| 4.18 | Step 7 (Done): "Go to dashboard" | Lands on dashboard (no loop back) | | |
| 4.19 | Refresh page on dashboard | Stays on dashboard (no onboarding redirect) | | |

---

## 5. DASHBOARD

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 5.1 | No TopNav header | Dashboard has own sidebar, no Referral Nova menu | | |
| 5.2 | No footer | No dark footer at bottom | | |
| 5.3 | No signup popup | Hidden on dashboard | | |
| 5.4 | Sidebar shows 10 nav items | Overview through Profile settings | | |
| 5.5 | Analytics is 2nd in sidebar | After Overview | | |
| 5.6 | Logout button at bottom of sidebar | Visible and clickable | | |
| 5.7 | Click logout | Redirected to /login, session cleared | | |
| 5.8 | Tab title says "VirtualProsNetwork" | Not "Referral Nova" | | |
| 5.9 | Favicon is VPN network icon | Two nodes icon | | |
| 5.10 | Upgrade banner shows for FREE user | "You're on the Free plan" with upgrade button | | |
| 5.11 | Click upgrade button | Goes to /dashboard/billing (not login) | | |

---

## 6. TIER GATING (FREE User)

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 6.1 | Dashboard Overview | Accessible ✓ | | |
| 6.2 | Analytics | Blurred + "Upgrade to Pro" lock | | |
| 6.3 | AI Suggestions | Blurred + lock | | |
| 6.4 | Referrals | Blurred + lock | | |
| 6.5 | My Network | Blurred + lock | | |
| 6.6 | Messages | Blurred + lock | | |
| 6.7 | Bookings | Blurred + lock | | |
| 6.8 | Leads | Accessible (3/month cap) | | |
| 6.9 | Availability | Accessible | | |
| 6.10 | Profile Settings | Accessible | | |
| 6.11 | My Listing | Accessible (1 max) | | |
| 6.12 | Upgrade link goes to /dashboard/billing | Not /pricing, not login | | |

---

## 7. BILLING / STRIPE

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 7.1 | /dashboard/billing shows 3 plans | Free (current), Pro ($49), Premium ($149) | | |
| 7.2 | Click "Upgrade to Pro" | Stripe checkout page opens (not demo) | | |
| 7.3 | No "Demo checkout" badge anywhere | Real payment flow | | |
| 7.4 | Complete Stripe payment (test card: 4242424242424242) | Redirected to success page | | |
| 7.5 | Success page says "Welcome to PRO!" | No demo badge | | |
| 7.6 | Dashboard refreshes with PRO tier | Gated features unlock | | |
| 7.7 | Cancel Stripe → redirected to /dashboard/billing | Not /pricing | | |

---

## 8. PROFILE SETTINGS

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 8.1 | CV view shows on first load | Gradient header, business name, tags | | |
| 8.2 | Business initial as avatar | First letter of business name | | |
| 8.3 | Services shown as tag pills | Blue rounded tags | | |
| 8.4 | ICP, Referrals, Barter sections visible | If data exists | | |
| 8.5 | "Record your 60-second intro" button | Visible when no video | | |
| 8.6 | Click record → camera opens | Live preview, record button | | |
| 8.7 | Click "Edit profile" | Full form appears | | |
| 8.8 | Change a field → Save changes | Returns to CV view with updated data | | |
| 8.9 | Click Cancel | Returns to CV view without saving | | |
| 8.10 | Photo upload field in edit mode | Click to upload visible | | |

---

## 9. ADMIN PANEL

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 9.1 | Login with admin email | Redirected to /admin (not /dashboard) | | |
| 9.2 | Sidebar shows: Overview, Users, Listings, Moderation, Zoom events, AI Pods, Bookings, Groups | All 8 items | | |
| 9.3 | Overview shows user count, listing count, MRR | Numbers render | | |
| 9.4 | Users: search by name or email | Results filter | | |
| 9.5 | Users: your row shows "(you)" | With disabled controls | | |
| 9.6 | Users: click "View" on another user | Read-only modal opens with profile details | | |
| 9.7 | Users: modal shows role, tier, email, listings, referrals | All fields visible | | |
| 9.8 | Users: close modal | Returns to user list, admin session intact | | |
| 9.9 | Users: change role dropdown (not self) | Confirm dialog → role updates | | |
| 9.10 | Users: suspend button (not self) | Requires reason, user suspended | | |
| 9.11 | Moderation: approve listing | Confirm dialog → listing goes live | | |
| 9.12 | Moderation: reject listing | Requires typed reason | | |
| 9.13 | Zoom events: form labels visible (dark theme) | All labels readable | | |
| 9.14 | Zoom events: default duration is 30 min | Not 60 | | |
| 9.15 | Zoom events: create event | Zoom link generated, event listed | | |
| 9.16 | AI Pods: "Run matchmaking now" button | Confirm dialog, results shown | | |
| 9.17 | AI Pods: pod cards show member names | Chips with names | | |
| 9.18 | "Exit admin" link | Returns to dashboard | | |

---

## 10. SEARCH & LISTINGS (Auth Required)

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 10.1 | /search when logged out | "Members only" card with login button | | |
| 10.2 | /search when logged in | Directory loads with listings | | |
| 10.3 | Filter by category | Results update | | |
| 10.4 | Filter by ZIP | Results update | | |
| 10.5 | Click listing card | Listing detail page loads (not homepage) | | |
| 10.6 | /listing/some-slug when logged out | "Members only" card | | |
| 10.7 | Listing detail: business name, rating, trust score | All visible | | |
| 10.8 | Trust score capped at 10.0/10 | Not 69.2/10 | | |
| 10.9 | "Book a call" button visible | For other users' listings | | |
| 10.10 | "Book a call" not visible on own listing | Can't book yourself | | |
| 10.11 | Click "Book a call" → booking modal opens | Reason selection, time slots | | |

---

## 11. SESSION MANAGEMENT

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 11.1 | Stay on dashboard 5+ minutes | No "session expired" or token errors | | |
| 11.2 | Refresh page | Stays logged in | | |
| 11.3 | Open new tab → dashboard | Logged in (refresh cookie) | | |
| 11.4 | Close browser, reopen → dashboard | Logged in (30-day cookie) | | |
| 11.5 | Navigate between dashboard pages | No loading errors | | |

---

## 12. EMAIL NOTIFICATIONS

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 12.1 | Signup → welcome email received | "Welcome aboard" with onboarding link | | |
| 12.2 | Onboarding link in welcome email | Points to virtualprosnetwork.com/onboarding (not comma URL) | | |
| 12.3 | OTP email received | 6-digit code, large centered display | | |
| 12.4 | OTP email subject | Contains the 6-digit code | | |
| 12.5 | Forgot password email | Reset link works | | |
| 12.6 | Reset link URL | Points to virtualprosnetwork.com (not comma URL) | | |

---

## 13. DUAL DOMAIN BRANDING

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 13.1 | referralnova.com → logo | Referral Nova with star icon | | |
| 13.2 | virtualprosnetwork.com → logo | VirtualPros with nodes icon | | |
| 13.3 | referralnova.com → footer | "© Referral Nova" + "Powering VPN" | | |
| 13.4 | virtualprosnetwork.com → footer | "© VirtualProsNetwork" | | |
| 13.5 | Login/signup page logos | Link to referralnova.com | | |
| 13.6 | Dashboard sidebar logo | VirtualPros, links to /dashboard | | |
| 13.7 | referralnova.com → tab title | "Referral Nova - AI-Powered..." | | |
| 13.8 | virtualprosnetwork.com → tab title | "VirtualProsNetwork - AI-Powered..." | | |
| 13.9 | Login page | Header at top, form in middle, footer at bottom | | |

---

## 14. SECURITY CHECKS

| # | Test | Expected | Pass/Fail | Notes |
|---|------|----------|-----------|-------|
| 14.1 | Try /dashboard without login | Redirected to /login | | |
| 14.2 | Try /admin without admin role | Redirected to /dashboard | | |
| 14.3 | Try signup with existing email | "Email already exists" error | | |
| 14.4 | Try 6+ signups in 1 hour (same IP) | Rate limited after 5 | | |
| 14.5 | Try /login?next=//evil.com | Does NOT redirect to evil.com | | |
| 14.6 | Supabase Data API disabled | 0 tables exposed | | |

---

## SUMMARY

| Section | Total Tests | Passed | Failed |
|---------|------------|--------|--------|
| 1. Public Website | 13 | | |
| 2. Signup Flow | 14 | | |
| 3. Google OAuth | 5 | | |
| 4. Onboarding | 19 | | |
| 5. Dashboard | 11 | | |
| 6. Tier Gating | 12 | | |
| 7. Billing/Stripe | 7 | | |
| 8. Profile Settings | 10 | | |
| 9. Admin Panel | 18 | | |
| 10. Search & Listings | 11 | | |
| 11. Session Management | 5 | | |
| 12. Email Notifications | 6 | | |
| 13. Dual Domain Branding | 9 | | |
| 14. Security Checks | 6 | | |
| **TOTAL** | **146** | | |

**Tested by:** ___________  **Date:** ___________  **Signature:** ___________
