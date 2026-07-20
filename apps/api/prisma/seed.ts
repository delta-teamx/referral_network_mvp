/**
 * Seed — populates reference data (categories, life-event → category map) and
 * admin accounts. It NO LONGER creates any demo/test businesses or members, and
 * it actively removes any that were seeded previously (see cleanupDemoData).
 *
 * Idempotent: re-running won't duplicate rows. Safe to run in CI.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORY_SEEDS } from '@refnet/shared';

const prisma = new PrismaClient();

// Accounts previously created by this seed (and by the removed seed-demo.sql).
// Anything matching these emails, or the @vpn-demo.com pattern, is test data.
const DEMO_EMAILS = [
  'demo-owner@virtualprosnetwork.local',
  'sarah@johnsonrealty.com',
  'daniel@tworiverscpa.com',
  'maya@stonegateweddings.com',
  'emma@bloomphoto.com',
];
const DEMO_GROUP_SLUG = 'stl-virtual-pros';

/**
 * Hard-delete every seeded/demo/test account, listing, group and all of their
 * dependent rows. Child rows are removed first because most relations have no
 * ON DELETE CASCADE. Only matches the demo email set + @vpn-demo.com pattern,
 * so real sign-ups are never touched. Idempotent — a no-op once clean.
 */
async function cleanupDemoData(): Promise<void> {
  const demoUsers = await prisma.user.findMany({
    where: { OR: [{ email: { in: DEMO_EMAILS } }, { email: { endsWith: '@vpn-demo.com' } }] },
    select: { id: true },
  });
  const ids = demoUsers.map((u) => u.id);
  const demoListings = await prisma.listing.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const listingIds = demoListings.map((l) => l.id);

  if (ids.length === 0 && listingIds.length === 0) {
    console.log('[seed] no demo/test data to remove.');
    return;
  }

  await prisma.introduction.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { targetId: { in: ids } }] },
  });
  await prisma.referralTracking.deleteMany({
    where: { OR: [{ referrerUserId: { in: ids } }, { inviteeUserId: { in: ids } }] },
  });
  await prisma.referral.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }, { listingId: { in: listingIds } }] },
  });
  await prisma.businessInvitation.deleteMany({
    where: { OR: [{ senderId: { in: ids } }, { recipientUserId: { in: ids } }] },
  });
  await prisma.businessConnection.deleteMany({
    where: { OR: [{ initiatorId: { in: ids } }, { targetId: { in: ids } }] },
  });
  await prisma.bookingCall.deleteMany({
    where: { OR: [{ hostId: { in: ids } }, { guestId: { in: ids } }] },
  });
  await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
  await prisma.eventRegistration.deleteMany({ where: { userId: { in: ids } } });
  await prisma.podMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.podFeedback.deleteMany({ where: { userId: { in: ids } } });
  await prisma.review.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { listingId: { in: listingIds } }] },
  });
  await prisma.consumerLead.deleteMany({
    where: { OR: [{ consumerId: { in: ids } }, { listingId: { in: listingIds } }] },
  });
  await prisma.favorite.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { listingId: { in: listingIds } }] },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: ids } } });
  await prisma.onboardingProgress.deleteMany({ where: { userId: { in: ids } } });
  await prisma.groupMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
  await prisma.memberProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.group.deleteMany({ where: { slug: DEMO_GROUP_SLUG } });
  const deleted = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `[seed] removed ${deleted.count} demo account(s), ${listingIds.length} demo listing(s), and their data.`,
  );
}

const LISTINGS = [
  {
    name: 'Johnson Realty',
    slug: 'johnson-realty',
    categorySlug: 'realtor',
    shortDescription:
      'Full-service residential realtor, St. Louis metro. 12 years, 400+ homes sold.',
    description:
      'Three-generation family brokerage serving the St. Louis metro since 2012. We specialise in first-time buyers, relocations, and investment properties. Bilingual agents on staff.',
    address: '1420 S Grand Blvd',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63104',
    phone: '+13145550101',
    email: 'hello@johnsonrealty.example',
    website: 'https://johnsonrealty.example',
    trustScore: 9.4,
    avgRating: 4.9,
    reviewCount: 182,
    isVerified: true,
    isFeatured: true,
  },
  {
    name: 'Nguyen Accounting & Tax',
    slug: 'nguyen-accounting',
    categorySlug: 'accountant',
    shortDescription: 'Small-business CPA. S-corps, LLC formation, quarterly taxes done right.',
    description:
      'CPA Theresa Nguyen helps small businesses in Missouri and Illinois stay compliant and pay less. Specialities: S-corp elections, multi-state sales tax, R&D credits.',
    address: '7701 Forsyth Blvd, Suite 400',
    city: 'Clayton',
    state: 'MO',
    zipCode: '63105',
    phone: '+13145550102',
    website: 'https://nguyen-cpa.example',
    trustScore: 9.1,
    avgRating: 4.8,
    reviewCount: 94,
    isVerified: true,
  },
  {
    name: 'Bloomhouse Florals',
    slug: 'bloomhouse-florals',
    categorySlug: 'florist',
    shortDescription: 'Weddings, events, sympathy. Same-day delivery across the metro.',
    description:
      'Seasonal, locally-sourced arrangements. Full-service wedding design, corporate weekly arrangements, and same-day sympathy delivery.',
    address: '118 W Argonne Dr',
    city: 'Kirkwood',
    state: 'MO',
    zipCode: '63122',
    phone: '+13145550103',
    website: 'https://bloomhouse.example',
    trustScore: 8.7,
    avgRating: 4.7,
    reviewCount: 56,
    isVerified: false,
  },
  {
    name: 'Cap City Electric',
    slug: 'cap-city-electric',
    categorySlug: 'electrician',
    shortDescription: 'Licensed residential + commercial electricians. 24/7 emergency calls.',
    description:
      'IBEW union shop. Panel upgrades, EV chargers, new construction, and 24/7 emergency response across the metro.',
    address: '14500 Manchester Rd',
    city: 'Ballwin',
    state: 'MO',
    zipCode: '63011',
    phone: '+13145550104',
    website: 'https://capcityelectric.example',
    trustScore: 8.9,
    avgRating: 4.9,
    reviewCount: 213,
    isVerified: true,
    isFeatured: true,
  },
  {
    name: 'Reed Family Law',
    slug: 'reed-family-law',
    categorySlug: 'lawyer',
    shortDescription: 'Divorce, custody, estate planning. Compassionate, fixed-fee where possible.',
    description:
      'Attorney Michelle Reed focuses exclusively on family law. Fixed-fee packages for uncontested divorce, custody mediation, and simple estate plans.',
    address: '7711 Bonhomme Ave',
    city: 'Clayton',
    state: 'MO',
    zipCode: '63105',
    phone: '+13145550105',
    website: 'https://reedfamilylaw.example',
    trustScore: 9.2,
    avgRating: 4.8,
    reviewCount: 71,
    isVerified: true,
  },
  {
    name: 'Harvest Table Catering',
    slug: 'harvest-table-catering',
    categorySlug: 'caterer',
    shortDescription: 'Farm-to-table catering for 20–500 guests. Dietary-friendly menus.',
    description:
      'Chef-driven catering sourcing from 14 Missouri farms. Weddings, corporate, intimate dinners. Gluten-free, vegan, and halal menus available.',
    address: '22 S Gore Ave',
    city: 'Webster Groves',
    state: 'MO',
    zipCode: '63119',
    phone: '+13145550106',
    website: 'https://harvesttable.example',
    trustScore: 8.5,
    avgRating: 4.7,
    reviewCount: 132,
    isVerified: true,
  },
  {
    name: 'Meridian Mortgage Group',
    slug: 'meridian-mortgage',
    categorySlug: 'mortgage-broker',
    shortDescription: 'Shop 40+ lenders at once. First-time buyers welcome.',
    description:
      "Independent mortgage brokerage. We pull rates from 40+ lenders so you don't have to. Conventional, FHA, VA, jumbo.",
    address: '101 S Hanley Rd',
    city: 'Clayton',
    state: 'MO',
    zipCode: '63105',
    phone: '+13145550107',
    website: 'https://meridianmortgage.example',
    trustScore: 8.8,
    avgRating: 4.8,
    reviewCount: 64,
    isVerified: true,
  },
  {
    name: 'Precision Home Inspectors',
    slug: 'precision-home-inspectors',
    categorySlug: 'home-inspector',
    shortDescription: '24-hour turnaround on full reports. InterNACHI certified.',
    description:
      'Retired engineers running home inspections the way we wish ours had been. Same-day reports with photos and thermal imaging.',
    address: '800 N Lindbergh Blvd',
    city: 'Creve Coeur',
    state: 'MO',
    zipCode: '63141',
    phone: '+13145550108',
    trustScore: 9.0,
    avgRating: 4.9,
    reviewCount: 88,
    isVerified: true,
  },
  {
    name: 'North Arrow Moving',
    slug: 'north-arrow-moving',
    categorySlug: 'moving-company',
    shortDescription: 'Local + interstate. Flat-rate quotes, no hourly surprises.',
    description:
      'Family-owned movers serving MO, IL, KS, IA. Flat-rate quotes, insured crews, free used-box program.',
    address: '3100 Hampton Ave',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63139',
    phone: '+13145550109',
    trustScore: 8.4,
    avgRating: 4.6,
    reviewCount: 210,
    isVerified: true,
  },
  {
    name: 'Sterling Interiors',
    slug: 'sterling-interiors',
    categorySlug: 'interior-designer',
    shortDescription: 'Full-service residential interior design. Renovations + styling.',
    description:
      'Boutique design studio specialising in mid-century modern and transitional styles. Full kitchen + primary suite renovations our specialty.',
    address: '7730 Forsyth Blvd',
    city: 'Clayton',
    state: 'MO',
    zipCode: '63105',
    phone: '+13145550110',
    trustScore: 8.6,
    avgRating: 4.8,
    reviewCount: 42,
    isVerified: true,
  },
  {
    name: 'Stonegate Wedding Planning',
    slug: 'stonegate-wedding-planning',
    categorySlug: 'wedding-planner',
    shortDescription: 'Full-service wedding planning. 60+ weddings a year.',
    description:
      'Award-winning wedding planners. Full-service, partial, and month-of packages. Venue scouting, vendor coordination, day-of coordination.',
    address: '1001 Highlands Plaza Dr W',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63110',
    phone: '+13145550111',
    trustScore: 9.0,
    avgRating: 4.9,
    reviewCount: 121,
    isVerified: true,
    isFeatured: true,
  },
  {
    name: 'Studio Seven Photography',
    slug: 'studio-seven-photography',
    categorySlug: 'photographer',
    shortDescription: 'Weddings, portraits, headshots. On-location + studio.',
    description:
      'Award-winning photography for weddings, families, and professional headshots. Natural, candid, unfussy.',
    address: '2200 Washington Ave',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63103',
    phone: '+13145550112',
    trustScore: 8.7,
    avgRating: 4.8,
    reviewCount: 78,
    isVerified: true,
  },
  {
    name: 'Beats on Broadway',
    slug: 'beats-on-broadway',
    categorySlug: 'dj',
    shortDescription: 'Wedding + corporate DJs. All-inclusive packages.',
    description:
      'Professional DJs with wedding-specific training. Top-tier sound + lighting. MC services included.',
    address: '310 N Broadway',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63102',
    phone: '+13145550113',
    trustScore: 8.2,
    avgRating: 4.7,
    reviewCount: 96,
    isVerified: true,
  },
  {
    name: 'Blue River Insurance',
    slug: 'blue-river-insurance',
    categorySlug: 'insurance-agent',
    shortDescription: 'Independent agent. Home, auto, commercial, umbrella.',
    description:
      'Independent agency quoting 15 top carriers. Home, auto, commercial, and umbrella policies. Plain-English coverage reviews.',
    address: '17295 Chesterfield Airport Rd',
    city: 'Chesterfield',
    state: 'MO',
    zipCode: '63005',
    phone: '+13145550114',
    trustScore: 8.5,
    avgRating: 4.6,
    reviewCount: 54,
    isVerified: true,
  },
  {
    name: 'Anvil & Axis Web Design',
    slug: 'anvil-axis-web',
    categorySlug: 'web-designer',
    shortDescription: 'Websites for small businesses. Flat fee, no hosting lock-in.',
    description:
      'Modern, conversion-focused websites for trades and local businesses. Flat-fee projects starting at $2,500. You own your domain and hosting.',
    address: '1101 Locust St',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63101',
    phone: '+13145550115',
    trustScore: 8.3,
    avgRating: 4.7,
    reviewCount: 31,
    isVerified: false,
  },
];

const EVENT_CATEGORY_MAP: Record<string, Array<{ slug: string; relevance: number }>> = {
  BUYING_HOUSE: [
    { slug: 'realtor', relevance: 10 },
    { slug: 'mortgage-broker', relevance: 9 },
    { slug: 'home-inspector', relevance: 8 },
    { slug: 'moving-company', relevance: 7 },
    { slug: 'insurance-agent', relevance: 6 },
    { slug: 'painter', relevance: 4 },
    { slug: 'cleaner', relevance: 3 },
  ],
  SELLING_HOUSE: [
    { slug: 'realtor', relevance: 10 },
    { slug: 'photographer', relevance: 7 },
    { slug: 'painter', relevance: 6 },
    { slug: 'cleaner', relevance: 6 },
    { slug: 'interior-designer', relevance: 5 },
  ],
  GETTING_MARRIED: [
    { slug: 'wedding-planner', relevance: 10 },
    { slug: 'photographer', relevance: 9 },
    { slug: 'caterer', relevance: 9 },
    { slug: 'florist', relevance: 8 },
    { slug: 'dj', relevance: 8 },
  ],
  STARTING_BUSINESS: [
    { slug: 'accountant', relevance: 10 },
    { slug: 'lawyer', relevance: 9 },
    { slug: 'web-designer', relevance: 8 },
    { slug: 'insurance-agent', relevance: 7 },
    { slug: 'marketing-agency', relevance: 7 },
  ],
  HAVING_BABY: [
    { slug: 'pediatrician', relevance: 10 },
    { slug: 'photographer', relevance: 6 },
  ],
  HOME_RENOVATION: [
    { slug: 'general-contractor', relevance: 10 },
    { slug: 'electrician', relevance: 9 },
    { slug: 'plumber', relevance: 9 },
    { slug: 'painter', relevance: 7 },
    { slug: 'interior-designer', relevance: 7 },
  ],
  MOVING_TO_NEW_CITY: [
    { slug: 'moving-company', relevance: 10 },
    { slug: 'realtor', relevance: 8 },
    { slug: 'cleaner', relevance: 6 },
  ],
  HOSTING_EVENT: [
    { slug: 'caterer', relevance: 10 },
    { slug: 'dj', relevance: 8 },
    { slug: 'florist', relevance: 7 },
    { slug: 'photographer', relevance: 7 },
  ],
  GETTING_DIVORCED: [
    { slug: 'lawyer', relevance: 10 },
    { slug: 'financial-planner', relevance: 7 },
    { slug: 'realtor', relevance: 6 },
  ],
  PLANNING_RETIREMENT: [
    { slug: 'financial-planner', relevance: 10 },
    { slug: 'lawyer', relevance: 7 },
    { slug: 'accountant', relevance: 7 },
  ],
  GOING_TO_COLLEGE: [
    { slug: 'moving-company', relevance: 6 },
    { slug: 'financial-planner', relevance: 5 },
  ],
  PLANNING_FUNERAL: [
    { slug: 'florist', relevance: 8 },
    { slug: 'caterer', relevance: 6 },
  ],
  OPENING_RESTAURANT: [
    { slug: 'general-contractor', relevance: 9 },
    { slug: 'accountant', relevance: 8 },
    { slug: 'lawyer', relevance: 7 },
    { slug: 'marketing-agency', relevance: 6 },
  ],
  CULTURAL_CELEBRATION: [
    { slug: 'caterer', relevance: 8 },
    { slug: 'florist', relevance: 7 },
    { slug: 'dj', relevance: 7 },
    { slug: 'photographer', relevance: 6 },
  ],
};

async function main() {
  console.log('[seed] upserting categories');
  for (const c of CATEGORY_SEEDS) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, icon: c.icon },
      update: { name: c.name, icon: c.icon },
    });
  }

  // Demo listings/businesses only seed when SEED_DEMO=true (never in production).
  if (process.env.SEED_DEMO === 'true') {
  console.log('[seed] ensuring demo business owner');
  const owner = await prisma.user.upsert({
    where: { email: 'demo-owner@virtualprosnetwork.local' },
    create: {
      email: 'demo-owner@virtualprosnetwork.local',
      firstName: 'Demo',
      lastName: 'Owner',
      role: 'BUSINESS_OWNER',
    },
    update: {},
  });

  console.log(`[seed] upserting ${LISTINGS.length} listings`);
  for (const l of LISTINGS) {
    const cat = await prisma.category.findUnique({ where: { slug: l.categorySlug } });
    if (!cat) continue;
    await prisma.listing.upsert({
      where: { slug: l.slug },
      create: {
        userId: owner.id,
        categoryId: cat.id,
        name: l.name,
        slug: l.slug,
        description: l.description,
        shortDescription: l.shortDescription,
        address: l.address,
        city: l.city,
        state: l.state,
        zipCode: l.zipCode,
        latitude: 38.627,
        longitude: -90.1994,
        phone: l.phone ?? null,
        email: l.email ?? null,
        website: l.website ?? null,
        trustScore: l.trustScore,
        avgRating: l.avgRating,
        reviewCount: l.reviewCount,
        isVerified: l.isVerified,
        isFeatured: l.isFeatured ?? false,
      },
      update: {
        description: l.description,
        shortDescription: l.shortDescription,
        trustScore: l.trustScore,
        avgRating: l.avgRating,
        reviewCount: l.reviewCount,
        isVerified: l.isVerified,
        isFeatured: l.isFeatured ?? false,
      },
    });
  }
  } // end SEED_DEMO (demo listings)

  console.log('[seed] upserting event→category relevance map');
  for (const [eventType, entries] of Object.entries(EVENT_CATEGORY_MAP)) {
    for (const entry of entries) {
      const cat = await prisma.category.findUnique({ where: { slug: entry.slug } });
      if (!cat) continue;
      await prisma.eventCategoryMap.upsert({
        where: {
          eventType_categoryId: {
            eventType: eventType as
              | 'BUYING_HOUSE'
              | 'SELLING_HOUSE'
              | 'GETTING_MARRIED'
              | 'STARTING_BUSINESS'
              | 'HAVING_BABY'
              | 'PLANNING_FUNERAL'
              | 'HOME_RENOVATION'
              | 'PLANNING_RETIREMENT'
              | 'MOVING_TO_NEW_CITY'
              | 'HOSTING_EVENT'
              | 'GOING_TO_COLLEGE'
              | 'GETTING_DIVORCED'
              | 'OPENING_RESTAURANT'
              | 'CULTURAL_CELEBRATION',
            categoryId: cat.id,
          },
        },
        create: {
          eventType: eventType as
            | 'BUYING_HOUSE'
            | 'SELLING_HOUSE'
            | 'GETTING_MARRIED'
            | 'STARTING_BUSINESS'
            | 'HAVING_BABY'
            | 'PLANNING_FUNERAL'
            | 'HOME_RENOVATION'
            | 'PLANNING_RETIREMENT'
            | 'MOVING_TO_NEW_CITY'
            | 'HOSTING_EVENT'
            | 'GOING_TO_COLLEGE'
            | 'GETTING_DIVORCED'
            | 'OPENING_RESTAURANT'
            | 'CULTURAL_CELEBRATION',
          categoryId: cat.id,
          relevance: entry.relevance,
        },
        update: { relevance: entry.relevance },
      });
    }
  }

  console.log('[seed] done seeding listings + event maps');

  // ---- Demo accounts with passwords (for local testing) ----------------------
  // Lazily import bcrypt so seed works whether or not the user ran a full build.
  const bcryptMod = await import('bcryptjs');
  const bcrypt = bcryptMod.default ?? bcryptMod;
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // Admin accounts from environment — no hardcoded credentials in the repo.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const adminPassword = process.env.ADMIN_PASSWORD ?? '';

  if (adminEmails.length > 0 && adminPassword.length >= 8) {
    console.log(`[seed] creating ${adminEmails.length} admin account(s) from ADMIN_EMAILS`);
    for (const email of adminEmails) {
      const parts = email.split('@')[0]?.split('.') ?? ['Admin'];
      const firstName = parts[0] ? parts[0][0]!.toUpperCase() + parts[0].slice(1) : 'Admin';
      const lastName = parts[1] ? parts[1][0]!.toUpperCase() + parts[1].slice(1) : 'Admin';
      const admin = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          passwordHash: hash(adminPassword),
          firstName,
          lastName,
          role: 'ADMIN',
          emailVerified: true,
          subscriptionTier: 'PREMIUM',
        },
        update: { role: 'ADMIN', passwordHash: hash(adminPassword) },
      });
      console.log(`  admin id=${admin.id} email=${email}`);
    }
  } else {
    console.log('[seed] ADMIN_EMAILS or ADMIN_PASSWORD not set — skipping admin creation');
    console.log('  Set ADMIN_EMAILS=a@x.com,b@x.com and ADMIN_PASSWORD=StrongPass123! in your .env');
  }

  // Demo members + demo group only seed when SEED_DEMO=true (never in production).
  if (process.env.SEED_DEMO === 'true') {
  console.log('[seed] creating demo member accounts + profiles');
  const members = [
    {
      email: 'sarah@johnsonrealty.com',
      password: 'Sarah123!',
      firstName: 'Sarah',
      lastName: 'Johnson',
      profile: {
        businessName: 'Johnson Realty Group',
        industry: 'Real Estate',
        headline: '5th-generation St. Louis realtor — 200+ closings since 2018.',
        keywords: ['realtor', 'residential', 'first-time buyer', 'relocation'],
        servicesOffered: ['Home buying', 'Home selling', 'Relocation services'],
        icpIndustries: ['mortgage / lending', 'home inspection', 'moving / relocation'],
        icpRoles: ['mortgage broker', 'inspector', 'mover'],
        canReferIndustries: ['plumbing', 'electrical', 'cleaning', 'painting'],
        canReferTypes: ['Homeowners needing repairs', 'Move-in cleaning'],
        openToBarter: true,
        barterOfferings: ['Free home valuation', 'Market analysis report'],
        barterWants: ['Photography', 'Staging consultation'],
        city: 'St. Louis', state: 'MO', zipCode: '63108',
      },
    },
    {
      email: 'daniel@tworiverscpa.com',
      password: 'Daniel123!',
      firstName: 'Daniel',
      lastName: 'Reyes',
      profile: {
        businessName: 'Two Rivers CPA',
        industry: 'Accounting / CPA',
        headline: 'Small-business CPA — bookkeeping, taxes, payroll.',
        keywords: ['cpa', 'taxes', 'bookkeeping', 's-corp', 'payroll'],
        servicesOffered: ['Tax preparation', 'Bookkeeping', 'S-Corp elections', 'Payroll'],
        icpIndustries: ['law', 'insurance', 'consulting', 'real estate'],
        icpRoles: ['business owner', 'startup founder'],
        canReferIndustries: ['law', 'financial planning', 'insurance'],
        canReferTypes: ['Small business owners needing legal help'],
        openToBarter: false,
        barterOfferings: [],
        barterWants: [],
        city: 'Clayton', state: 'MO', zipCode: '63105',
      },
    },
    {
      email: 'maya@stonegateweddings.com',
      password: 'Maya1234!',
      firstName: 'Maya',
      lastName: 'Patel',
      profile: {
        businessName: 'Stonegate Wedding Planning',
        industry: 'Wedding Planning',
        headline: 'Boutique wedding planning — 80+ weddings, zero disasters.',
        keywords: ['wedding', 'event', 'planner', 'coordinator', 'venue'],
        servicesOffered: ['Full planning', 'Day-of coordination', 'Vendor management'],
        icpIndustries: ['photography', 'catering / food', 'floral', 'dj / entertainment'],
        icpRoles: ['photographer', 'caterer', 'florist', 'dj'],
        canReferIndustries: ['photography', 'catering / food', 'floral'],
        canReferTypes: ['Brides needing vendors', 'Corporate event planners'],
        openToBarter: true,
        barterOfferings: ['Free event consultation', 'Vendor negotiation'],
        barterWants: ['Web design', 'Social media management'],
        city: 'St. Louis', state: 'MO', zipCode: '63108',
      },
    },
    {
      email: 'emma@bloomphoto.com',
      password: 'Emma1234!',
      firstName: 'Emma',
      lastName: 'Chen',
      profile: {
        businessName: 'Bloom Photography',
        industry: 'Photography',
        headline: 'Wedding + family portrait photography. Booking 2026 dates.',
        keywords: ['photographer', 'wedding', 'portraits', 'headshots'],
        servicesOffered: ['Wedding photography', 'Family portraits', 'Headshots'],
        icpIndustries: ['wedding planning', 'real estate', 'marketing'],
        icpRoles: ['wedding planner', 'realtor', 'marketing agency'],
        canReferIndustries: ['wedding planning', 'catering / food', 'floral'],
        canReferTypes: ['Brides looking for planners', 'Businesses needing headshots'],
        openToBarter: true,
        barterOfferings: ['Free headshot session', '10 edited photos'],
        barterWants: ['Legal review', 'Tax prep', 'Web design'],
        city: 'St. Louis', state: 'MO', zipCode: '63112',
      },
    },
  ];

  for (const m of members) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      create: {
        email: m.email,
        passwordHash: hash(m.password),
        firstName: m.firstName,
        lastName: m.lastName,
        role: 'BUSINESS_OWNER',
        emailVerified: true,
      },
      update: {},
    });
    await prisma.memberProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...m.profile },
      update: {},
    });
    console.log(`  ${m.firstName} ${m.lastName}: email=${m.email} pw=${m.password}`);
  }

  // Create a demo group with the members
  console.log('[seed] creating demo group');
  const group = await prisma.group.upsert({
    where: { slug: 'stl-virtual-pros' },
    create: {
      name: 'STL Referral Nova',
      slug: 'stl-virtual-pros',
      description: 'Referral Nova St. Louis chapter — the AI-powered referral network.',
      city: 'St. Louis',
      state: 'MO',
      meetingSchedule: 'Every Tuesday 7am (virtual)',
      maxMembers: 30,
      isPublic: true,
    },
    update: {},
  });

  // Add all members + admin to the group
  for (const m of members) {
    const user = await prisma.user.findUnique({ where: { email: m.email }, select: { id: true } });
    if (!user) continue;
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      create: { groupId: group.id, userId: user.id, role: 'MEMBER' },
      update: {},
    });
  }
  // Make the first admin the group leader (if any admin was seeded)
  if (adminEmails.length > 0) {
    const firstAdmin = await prisma.user.findUnique({ where: { email: adminEmails[0] }, select: { id: true } });
    if (firstAdmin) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: firstAdmin.id } },
        create: { groupId: group.id, userId: firstAdmin.id, role: 'LEADER' },
        update: {},
      });
    }
  }
  } // end SEED_DEMO (demo members + group)

  // Always remove any demo/test data that a previous seed created.
  await cleanupDemoData();

  console.log('[seed] all done!');
  console.log('');
  console.log('=== Seed Complete ===');
  if (adminEmails.length > 0) {
    console.log(`Admin(s): ${adminEmails.join(', ')} (password set via ADMIN_PASSWORD env var)`);
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
