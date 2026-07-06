-- ============================================================================
-- Demo member seed — 10 interconnected business owners.
--
-- Purpose: give the AI matching engine a dense, realistic network so that a
-- freshly-onboarded profile immediately gets high-quality suggestions. Each
-- member's "who I want to meet" (icpIndustries) lines up with another
-- member's industry, and their "who I refer" (canReferIndustries) closes the
-- loop the other way — so the two-sided matcher fires for almost everyone.
--
-- Fully IDEMPOTENT: re-running inserts nothing that already exists (keyed on
-- the @vpn-demo.com emails). Safe to run against production. To remove later:
--   DELETE FROM "MemberProfile" WHERE "userId" IN
--     (SELECT id FROM "User" WHERE email LIKE '%@vpn-demo.com');
--   DELETE FROM "User" WHERE email LIKE '%@vpn-demo.com';
-- ============================================================================

-- 1) Users --------------------------------------------------------------------
INSERT INTO "User" (id, email, "firstName", "lastName", role, "subscriptionTier", "emailVerified", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.email, v.first, v.last,
       'BUSINESS_OWNER'::"UserRole", 'FREE'::"SubscriptionTier", true, now(), now()
FROM (VALUES
  ('sarah.johnson@vpn-demo.com','Sarah','Johnson'),
  ('marcus.lee@vpn-demo.com','Marcus','Lee'),
  ('priya.nair@vpn-demo.com','Priya','Nair'),
  ('daniel.reyes@vpn-demo.com','Daniel','Reyes'),
  ('elena.vasquez@vpn-demo.com','Elena','Vasquez'),
  ('maya.patel@vpn-demo.com','Maya','Patel'),
  ('chris.obi@vpn-demo.com','Chris','Obi'),
  ('tara.nguyen@vpn-demo.com','Tara','Nguyen'),
  ('sam.wright@vpn-demo.com','Sam','Wright'),
  ('jordan.kim@vpn-demo.com','Jordan','Kim'),
  ('nadia.brooks@vpn-demo.com','Nadia','Brooks')
) AS v(email, first, last)
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.email = v.email);

-- 2) Member profiles ----------------------------------------------------------
INSERT INTO "MemberProfile" (
  id, "userId", "businessName", industry, headline, bio,
  "servicesOffered", keywords, "icpIndustries", "icpRoles",
  "canReferIndustries", "canReferTypes", city, state, "serviceArea",
  "openToBarter", "barterOfferings", "barterWants", "photoUrl",
  "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), u.id, v.biz, v.industry, v.headline, v.bio,
       v.services, v.keywords, v.icp_ind, v.icp_roles,
       v.refer_ind, v.refer_types, v.city, v.state, v.service_area,
       v.barter, v.barter_offer, v.barter_want,
       'https://i.pravatar.cc/600?u=' || v.email,
       now(), now()
FROM (VALUES
  ('sarah.johnson@vpn-demo.com','Johnson Realty Group','Real Estate',
   '5th-generation St. Louis realtor — 200+ closings since 2018.',
   'We help families buy and sell across the St. Louis metro. Most of my buyers need a lender, an inspector and insurance the same week.',
   ARRAY['Buyer representation','Listing / selling','Relocation'],
   ARRAY['real estate','homes','buyers','sellers','relocation'],
   ARRAY['Mortgage / Lending','Home Inspection','Insurance','Moving / Relocation'],
   ARRAY['loan officer','inspector','agent'],
   ARRAY['Mortgage / Lending','Home Inspection','Roofing','Insurance'],
   ARRAY['First-time home buyers','Home sellers','Families relocating'],
   'St. Louis','MO','local', false, ARRAY[]::text[], ARRAY[]::text[]),

  ('marcus.lee@vpn-demo.com','Gateway Mortgage Co.','Mortgage / Lending',
   'Purchase & refi loans that actually close on time.',
   'I fund home loans for buyers across Missouri. Realtors are my best referral partners and I send every borrower to a trusted agent.',
   ARRAY['Home purchase loans','Refinancing','Pre-approvals'],
   ARRAY['mortgage','lending','loans','refinance','pre-approval'],
   ARRAY['Real Estate','Insurance','Financial Planning'],
   ARRAY['agent','broker'],
   ARRAY['Real Estate','Insurance'],
   ARRAY['Home buyers needing financing','Refinance leads'],
   'St. Louis','MO','remote', false, ARRAY[]::text[], ARRAY[]::text[]),

  ('priya.nair@vpn-demo.com','Nair Home Inspections','Home Inspection',
   'Same-week inspections with photo reports buyers understand.',
   'Independent home inspector. Realtors and buyers rely on me before closing; I refer out every repair I find.',
   ARRAY['Buyer inspections','Radon testing','Pre-listing inspections'],
   ARRAY['inspection','radon','home','buyers','reports'],
   ARRAY['Real Estate','Roofing','General Contracting'],
   ARRAY['agent','contractor'],
   ARRAY['Roofing','General Contracting','Plumbing','Electrical'],
   ARRAY['Homeowners needing repairs','Buyers with inspection findings'],
   'Clayton','MO','local', false, ARRAY[]::text[], ARRAY[]::text[]),

  ('daniel.reyes@vpn-demo.com','Two Rivers CPA','Accounting / CPA',
   'Small-business CPA — bookkeeping, taxes, payroll under one roof.',
   'I keep small businesses compliant and profitable. My clients constantly ask me for marketers, lawyers and financial planners.',
   ARRAY['Bookkeeping','Tax prep','Payroll'],
   ARRAY['accounting','cpa','tax','bookkeeping','payroll'],
   ARRAY['Marketing','Consulting','Law','Insurance'],
   ARRAY['founder','owner','consultant'],
   ARRAY['Law','Financial Planning','Marketing'],
   ARRAY['Small business owners','Startup founders'],
   'Clayton','MO','remote', true,
   ARRAY['Quarterly bookkeeping review','Tax-savings consult'],
   ARRAY['website design','Facebook Ads']),

  ('elena.vasquez@vpn-demo.com','Clocktower Insurance','Insurance',
   'Home, auto and life coverage that fits real budgets.',
   'Independent insurance agent. New homeowners and drivers are my sweet spot, and I refer clients to agents and planners weekly.',
   ARRAY['Home insurance','Auto insurance','Life insurance'],
   ARRAY['insurance','home','auto','life','coverage'],
   ARRAY['Real Estate','Auto Services','Financial Planning'],
   ARRAY['agent','loan officer'],
   ARRAY['Real Estate','Financial Planning','Mortgage / Lending'],
   ARRAY['New homeowners','New drivers','Families'],
   'St. Louis','MO','local', false, ARRAY[]::text[], ARRAY[]::text[]),

  ('maya.patel@vpn-demo.com','Stonegate Wedding Planning','Wedding Planning',
   'Boutique wedding planning — 80+ weddings and counting.',
   'Full-service wedding planner. Every couple needs a photographer, caterer, florist and DJ — I match them constantly.',
   ARRAY['Full planning','Day-of coordination','Vendor sourcing'],
   ARRAY['wedding','planner','events','coordination','couples'],
   ARRAY['Photography','Catering / Food','Floral','DJ / Entertainment'],
   ARRAY['photographer','caterer','florist','dj'],
   ARRAY['Photography','Catering / Food','Floral','DJ / Entertainment'],
   ARRAY['Engaged couples','Event hosts'],
   'St. Charles','MO','local', true,
   ARRAY['Featured vendor placement','Styled-shoot coordination'],
   ARRAY['photography','floral arrangements']),

  ('chris.obi@vpn-demo.com','Obi Photography','Photography',
   'Wedding & brand photography with a documentary eye.',
   'I shoot weddings and small-business brand photos. Planners and florists are my referral lifeblood.',
   ARRAY['Wedding photography','Brand / headshots','Event coverage'],
   ARRAY['photography','wedding','headshots','brand','events'],
   ARRAY['Wedding Planning','Marketing','Floral'],
   ARRAY['planner','marketer'],
   ARRAY['Wedding Planning','Floral','Marketing'],
   ARRAY['Engaged couples','Small businesses needing brand photos'],
   'St. Louis','MO','remote', true,
   ARRAY['Branded headshot session'],
   ARRAY['marketing','web design']),

  ('tara.nguyen@vpn-demo.com','Bloomhouse Floral','Floral',
   'Seasonal, locally-grown wedding & event florals.',
   'Florist specializing in weddings and events. I work hand-in-hand with planners, photographers and caterers.',
   ARRAY['Wedding florals','Event arrangements','Installations'],
   ARRAY['floral','flowers','wedding','events','arrangements'],
   ARRAY['Wedding Planning','Photography','Catering / Food'],
   ARRAY['planner','photographer'],
   ARRAY['Wedding Planning','Catering / Food','Photography'],
   ARRAY['Engaged couples','Event hosts'],
   'Kirkwood','MO','local', false, ARRAY[]::text[], ARRAY[]::text[]),

  ('sam.wright@vpn-demo.com','Wright Digital','Marketing',
   'Lead-gen marketing for local service businesses.',
   'I run ads and build funnels for local pros. I constantly need web designers and refer clients to CPAs and consultants.',
   ARRAY['Facebook Ads','Google Ads','Funnels & CRM'],
   ARRAY['marketing','ads','lead generation','funnels','automation'],
   ARRAY['Web Design / Development','Consulting','Real Estate','Accounting / CPA'],
   ARRAY['designer','developer','consultant'],
   ARRAY['Web Design / Development','Consulting','Accounting / CPA'],
   ARRAY['Local service businesses','Realtors','Owners scaling up'],
   'St. Louis','MO','international', true,
   ARRAY['Facebook Ads account audit','Landing-page copy'],
   ARRAY['web design','logo design','bookkeeping']),

  ('jordan.kim@vpn-demo.com','Kim Web Studio','Web Design / Development',
   'Fast, conversion-focused websites for small businesses.',
   'I build and maintain websites for local businesses. Marketers and consultants send me most of my work — and I return the favor.',
   ARRAY['Website design','Landing pages','Website care plans'],
   ARRAY['web design','development','websites','landing pages','seo'],
   ARRAY['Marketing','Consulting','Accounting / CPA'],
   ARRAY['marketer','consultant'],
   ARRAY['Marketing','Consulting'],
   ARRAY['Businesses needing a website','Rebrands'],
   'St. Louis','MO','international', true,
   ARRAY['Landing page build','Website speed audit'],
   ARRAY['Facebook Ads','marketing strategy']),

  ('nadia.brooks@vpn-demo.com','Nightshift DJ & Events','DJ / Entertainment',
   'Weddings and corporate events that keep the floor full.',
   'Event DJ and MC. Wedding planners and venues book me year-round; I refer photographers and florists to every couple.',
   ARRAY['Wedding DJ','Corporate events','Lighting'],
   ARRAY['dj','entertainment','wedding','events','music'],
   ARRAY['Wedding Planning','Photography','Catering / Food'],
   ARRAY['planner','photographer'],
   ARRAY['Wedding Planning','Photography','Floral'],
   ARRAY['Engaged couples','Corporate event hosts'],
   'St. Louis','MO','local', false, ARRAY[]::text[], ARRAY[]::text[])
) AS v(email, biz, industry, headline, bio, services, keywords, icp_ind, icp_roles,
       refer_ind, refer_types, city, state, service_area, barter, barter_offer, barter_want)
JOIN "User" u ON u.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM "MemberProfile" mp WHERE mp."userId" = u.id);
