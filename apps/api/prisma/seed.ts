/**
 * Seed — populates demo data so the homepage, directory, and life-events
 * connector all work out of the box after a fresh `prisma migrate`.
 *
 * Idempotent: re-running won't duplicate rows. Safe to run in CI.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORY_SEEDS } from '@refnet/shared';

const prisma = new PrismaClient();

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

  console.log('[seed] ensuring demo business owner');
  const owner = await prisma.user.upsert({
    where: { email: 'demo-owner@referralnetworkusa.local' },
    create: {
      email: 'demo-owner@referralnetworkusa.local',
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

  console.log('[seed] done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
