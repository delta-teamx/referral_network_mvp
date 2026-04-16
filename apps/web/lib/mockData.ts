/**
 * Demo-mode mock data. Used when `NEXT_PUBLIC_API_URL` is unset OR the API
 * is unreachable. Lets us ship a frontend-only demo to Netlify and have every
 * page look real to a client/stakeholder.
 *
 * Triggered by `lib/api.ts` — see `isDemoMode()` and the fetch fallback.
 */

export interface MockListing {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDescription: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  avgRating: number;
  reviewCount: number;
  trustScore: number;
  isVerified: boolean;
  isFeatured: boolean;
  category: { name: string; slug: string; icon: string | null };
  photos: { id: string; url: string; caption: string | null }[];
  _count: { reviews: number; referrals: number };
}

export interface MockReview {
  id: string;
  rating: number;
  title: string | null;
  text: string;
  isVerified: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string; avatarUrl: string | null };
}

export interface MockCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

export const MOCK_CATEGORIES: MockCategory[] = [
  { id: 'cat-realtor', name: 'Realtor', slug: 'realtor', icon: 'home' },
  { id: 'cat-mortgage', name: 'Mortgage Broker', slug: 'mortgage-broker', icon: 'bank' },
  { id: 'cat-inspector', name: 'Home Inspector', slug: 'home-inspector', icon: 'clipboard' },
  { id: 'cat-mover', name: 'Moving Company', slug: 'moving-company', icon: 'truck' },
  { id: 'cat-plumber', name: 'Plumber', slug: 'plumber', icon: 'wrench' },
  { id: 'cat-electrician', name: 'Electrician', slug: 'electrician', icon: 'bolt' },
  { id: 'cat-contractor', name: 'General Contractor', slug: 'general-contractor', icon: 'hammer' },
  { id: 'cat-painter', name: 'Painter', slug: 'painter', icon: 'brush' },
  { id: 'cat-cleaner', name: 'Cleaning Service', slug: 'cleaner', icon: 'spray' },
  { id: 'cat-photographer', name: 'Photographer', slug: 'photographer', icon: 'camera' },
  { id: 'cat-wedding', name: 'Wedding Planner', slug: 'wedding-planner', icon: 'rings' },
  { id: 'cat-caterer', name: 'Caterer', slug: 'caterer', icon: 'chef' },
  { id: 'cat-florist', name: 'Florist', slug: 'florist', icon: 'flower' },
  { id: 'cat-dj', name: 'DJ / Entertainment', slug: 'dj', icon: 'music' },
  { id: 'cat-accountant', name: 'Accountant / CPA', slug: 'accountant', icon: 'calculator' },
  { id: 'cat-lawyer', name: 'Lawyer', slug: 'lawyer', icon: 'gavel' },
  { id: 'cat-insurance', name: 'Insurance Agent', slug: 'insurance-agent', icon: 'shield' },
  { id: 'cat-web', name: 'Web Designer / Developer', slug: 'web-designer', icon: 'code' },
  { id: 'cat-marketing', name: 'Marketing Agency', slug: 'marketing-agency', icon: 'megaphone' },
  { id: 'cat-interior', name: 'Interior Designer', slug: 'interior-designer', icon: 'palette' },
  { id: 'cat-pediatrician', name: 'Pediatrician', slug: 'pediatrician', icon: 'stethoscope' },
  { id: 'cat-financial', name: 'Financial Planner', slug: 'financial-planner', icon: 'chart' },
];

const cat = (slug: string) => {
  const found = MOCK_CATEGORIES.find((c) => c.slug === slug)!;
  return { name: found.name, slug: found.slug, icon: found.icon };
};

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: 'list-johnson',
    slug: 'johnson-realty-group',
    name: 'Johnson Realty Group',
    shortDescription: '5th-generation St. Louis realtor — 200+ closings since 2018.',
    description:
      'Johnson Realty Group has been helping St. Louis families buy and sell homes for over 35 years. Sarah Johnson, our lead agent, has personally closed 200+ transactions since 2018 with an average days-on-market of 12. We specialize in first-time buyers, downsizers, and luxury relocations across the metro.',
    address: '4520 Laclede Ave',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63108',
    phone: '(314) 555-0142',
    email: 'sarah@johnsonrealty.com',
    website: 'https://johnsonrealty.example',
    avgRating: 4.9,
    reviewCount: 87,
    trustScore: 96,
    isVerified: true,
    isFeatured: true,
    category: cat('realtor'),
    photos: [],
    _count: { reviews: 87, referrals: 32 },
  },
  {
    id: 'list-cap-city',
    slug: 'cap-city-electric',
    name: 'Cap City Electric',
    shortDescription: 'Licensed master electrician — emergency calls answered in 60 minutes.',
    description:
      'Cap City Electric is a family-owned electrical contractor serving the greater St. Louis area for 22 years. We handle residential rewiring, panel upgrades, EV charger installation, and 24/7 emergency calls. Master license #E-44210, bonded and insured up to $2M.',
    address: '812 N Broadway',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63102',
    phone: '(314) 555-0177',
    email: 'dispatch@capcityelectric.com',
    website: 'https://capcityelectric.example',
    avgRating: 4.8,
    reviewCount: 64,
    trustScore: 92,
    isVerified: true,
    isFeatured: false,
    category: cat('electrician'),
    photos: [],
    _count: { reviews: 64, referrals: 19 },
  },
  {
    id: 'list-stonegate',
    slug: 'stonegate-wedding-planning',
    name: 'Stonegate Wedding Planning',
    shortDescription: 'Boutique wedding planning — 80+ weddings, zero "wedding-day disasters."',
    description:
      'Stonegate Wedding Planning is a boutique full-service planning firm. Founder Maya Patel has planned 80+ weddings in Missouri and Illinois with a perfect 5-star vendor coordination record. Packages range from day-of coordination to 18-month full planning.',
    address: '32 Maryland Plaza',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63108',
    phone: '(314) 555-0188',
    email: 'maya@stonegateweddings.com',
    website: 'https://stonegateweddings.example',
    avgRating: 5.0,
    reviewCount: 41,
    trustScore: 98,
    isVerified: true,
    isFeatured: true,
    category: cat('wedding-planner'),
    photos: [],
    _count: { reviews: 41, referrals: 27 },
  },
  {
    id: 'list-river-bend',
    slug: 'river-bend-mortgage',
    name: 'River Bend Mortgage',
    shortDescription: 'Conventional, FHA, VA, jumbo — fastest pre-approval in the metro.',
    description:
      'River Bend Mortgage is a local mortgage broker offering conventional, FHA, VA, and jumbo loans. Our average pre-approval turnaround is 4 hours and we close in under 21 days on 92% of files. We work with 47 wholesale lenders to get you the best rate, not just one bank\u2019s rate.',
    address: '1100 Olive St Suite 410',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63101',
    phone: '(314) 555-0231',
    email: 'loans@riverbendmtg.com',
    website: 'https://riverbendmtg.example',
    avgRating: 4.7,
    reviewCount: 53,
    trustScore: 89,
    isVerified: true,
    isFeatured: false,
    category: cat('mortgage-broker'),
    photos: [],
    _count: { reviews: 53, referrals: 22 },
  },
  {
    id: 'list-keystone-inspect',
    slug: 'keystone-home-inspection',
    name: 'Keystone Home Inspection',
    shortDescription: 'InterNACHI-certified — 200-point inspection, same-day report.',
    description:
      'Keystone Home Inspection is an InterNACHI-certified inspection firm. Every inspection includes 200+ checkpoints, drone roof imaging, thermal scan, and a same-day digital report your buyer agent can forward immediately.',
    address: '4200 Manchester Ave',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63110',
    phone: '(314) 555-0299',
    email: 'book@keystoneinspect.com',
    website: 'https://keystoneinspect.example',
    avgRating: 4.9,
    reviewCount: 71,
    trustScore: 94,
    isVerified: true,
    isFeatured: false,
    category: cat('home-inspector'),
    photos: [],
    _count: { reviews: 71, referrals: 18 },
  },
  {
    id: 'list-two-rivers-cpa',
    slug: 'two-rivers-cpa',
    name: 'Two Rivers CPA',
    shortDescription: 'Small-business CPA — bookkeeping, taxes, payroll under one roof.',
    description:
      'Two Rivers CPA serves 180+ small businesses across Missouri and Illinois. Founder Daniel Reyes is a CPA + EA (Enrolled Agent) who specializes in S-corp election strategy, R&D tax credits, and IRS audit defense.',
    address: '7733 Forsyth Blvd',
    city: 'Clayton',
    state: 'MO',
    zipCode: '63105',
    phone: '(314) 555-0312',
    email: 'daniel@tworiverscpa.com',
    website: 'https://tworiverscpa.example',
    avgRating: 4.8,
    reviewCount: 38,
    trustScore: 91,
    isVerified: true,
    isFeatured: false,
    category: cat('accountant'),
    photos: [],
    _count: { reviews: 38, referrals: 14 },
  },
  {
    id: 'list-bloom-photo',
    slug: 'bloom-photography',
    name: 'Bloom Photography',
    shortDescription: 'Wedding + family portrait photography. Booking 2026 dates now.',
    description:
      'Bloom Photography is led by Emma Chen, a 12-year wedding and family portrait specialist. Featured in Brides STL and Saint Louis Magazine. Packages start at $2,400 with 8 hours of coverage and 500+ edited photos.',
    address: '5872 Delmar Blvd',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63112',
    phone: '(314) 555-0444',
    email: 'emma@bloomphoto.com',
    website: 'https://bloomphoto.example',
    avgRating: 4.9,
    reviewCount: 56,
    trustScore: 95,
    isVerified: true,
    isFeatured: false,
    category: cat('photographer'),
    photos: [],
    _count: { reviews: 56, referrals: 21 },
  },
  {
    id: 'list-prime-movers',
    slug: 'prime-movers-stl',
    name: 'Prime Movers STL',
    shortDescription: 'Local + long-distance movers. Flat-rate quotes, no surprises.',
    description:
      'Prime Movers STL has handled 4,200+ moves since 2014. We offer flat-rate quotes (no hourly creep), full-service packing, piano + safe specialty moves, and long-distance interstate moves to all 48 states. DOT #2987114, MC #998877.',
    address: '2400 Hampton Ave',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63139',
    phone: '(314) 555-0567',
    email: 'quote@primemoversstl.com',
    website: 'https://primemovers.example',
    avgRating: 4.6,
    reviewCount: 102,
    trustScore: 87,
    isVerified: true,
    isFeatured: false,
    category: cat('moving-company'),
    photos: [],
    _count: { reviews: 102, referrals: 16 },
  },
  {
    id: 'list-greenleaf-clean',
    slug: 'greenleaf-cleaning',
    name: 'Greenleaf Cleaning Co.',
    shortDescription: 'Eco-friendly residential + Airbnb cleaning. Same-cleaner guarantee.',
    description:
      'Greenleaf Cleaning Co. uses 100% non-toxic, child- and pet-safe cleaning products. We offer weekly, biweekly, monthly, deep-clean, and Airbnb turnover services. Same cleaner every visit \u2014 we don\u2019t rotate strangers through your home.',
    address: '1456 S Grand Blvd',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63104',
    phone: '(314) 555-0623',
    email: 'hello@greenleafclean.com',
    website: 'https://greenleafclean.example',
    avgRating: 4.7,
    reviewCount: 89,
    trustScore: 88,
    isVerified: false,
    isFeatured: false,
    category: cat('cleaner'),
    photos: [],
    _count: { reviews: 89, referrals: 11 },
  },
  {
    id: 'list-gateway-law',
    slug: 'gateway-family-law',
    name: 'Gateway Family Law',
    shortDescription: 'Divorce, custody, adoption \u2014 free 30-min consult.',
    description:
      'Gateway Family Law is a Missouri-licensed family law practice. Lead attorney Karen Vasquez has 18 years of practice and offers a free 30-minute consultation. Sliding-scale billing available for qualifying families.',
    address: '720 Olive St Suite 1900',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63101',
    phone: '(314) 555-0712',
    email: 'intake@gatewayfamilylaw.com',
    website: 'https://gatewayfamilylaw.example',
    avgRating: 4.8,
    reviewCount: 47,
    trustScore: 93,
    isVerified: true,
    isFeatured: false,
    category: cat('lawyer'),
    photos: [],
    _count: { reviews: 47, referrals: 9 },
  },
  {
    id: 'list-pixel-craft',
    slug: 'pixelcraft-studios',
    name: 'PixelCraft Studios',
    shortDescription: 'Custom websites + e-commerce for local businesses. 30-day launches.',
    description:
      'PixelCraft Studios builds Shopify, WordPress, and custom Next.js sites for local businesses. Average project ships in 30 days. Past clients include 40+ STL restaurants, 12 medical practices, and 6 home-services companies.',
    address: '3148 Cherokee St',
    city: 'St. Louis',
    state: 'MO',
    zipCode: '63118',
    phone: '(314) 555-0844',
    email: 'projects@pixelcraft.dev',
    website: 'https://pixelcraft.example',
    avgRating: 4.9,
    reviewCount: 31,
    trustScore: 90,
    isVerified: false,
    isFeatured: false,
    category: cat('web-designer'),
    photos: [],
    _count: { reviews: 31, referrals: 8 },
  },
  {
    id: 'list-summit-insurance',
    slug: 'summit-insurance-agency',
    name: 'Summit Insurance Agency',
    shortDescription: 'Independent broker \u2014 18 carriers, auto/home/life/business.',
    description:
      'Summit Insurance Agency is an independent broker representing 18 top-rated carriers. We compare auto, home, life, umbrella, and small-business policies to find you the right coverage at the lowest premium. No captive obligations.',
    address: '14323 S Outer Forty Rd',
    city: 'Chesterfield',
    state: 'MO',
    zipCode: '63017',
    phone: '(314) 555-0901',
    email: 'quotes@summitinsurance.com',
    website: 'https://summitins.example',
    avgRating: 4.8,
    reviewCount: 62,
    trustScore: 92,
    isVerified: true,
    isFeatured: false,
    category: cat('insurance-agent'),
    photos: [],
    _count: { reviews: 62, referrals: 13 },
  },
];

export const MOCK_REVIEWS: MockReview[] = [
  {
    id: 'rev-1',
    rating: 5,
    title: 'Sold our home in 9 days, $20K over asking',
    text: 'Sarah priced the listing perfectly and got us 14 showings in the first weekend. We had three competing offers by Monday. Genuinely the smoothest closing we\u2019ve ever had.',
    isVerified: true,
    createdAt: isoDaysAgo(12),
    user: { firstName: 'Marcus', lastName: 'D.', avatarUrl: null },
  },
  {
    id: 'rev-2',
    rating: 5,
    title: 'First-time buyer \u2014 she made it easy',
    text: 'I was terrified of buying a house. Sarah walked me through every step, never made me feel dumb for asking basic questions. Closed on a duplex 4 months later. Already referred my brother.',
    isVerified: true,
    createdAt: isoDaysAgo(34),
    user: { firstName: 'Priya', lastName: 'K.', avatarUrl: null },
  },
  {
    id: 'rev-3',
    rating: 5,
    title: 'Knows the metro inside out',
    text: 'We were relocating from Chicago and needed someone who actually knew the schools, the commute times, the neighborhoods. Sarah toured us through five neighborhoods in one Saturday and we picked the right one.',
    isVerified: false,
    createdAt: isoDaysAgo(58),
    user: { firstName: 'James', lastName: 'O.', avatarUrl: null },
  },
];

const featured = MOCK_LISTINGS[0]!;

export const MOCK_DASHBOARD_METRICS = {
  user: {
    id: 'demo-user',
    firstName: 'Demo',
    lastName: 'Owner',
    email: 'demo@referralnetworkusa.app',
  },
  trustScore: 87,
  listings: [
    {
      id: featured.id,
      slug: featured.slug,
      name: featured.name,
      avgRating: featured.avgRating,
      reviewCount: featured.reviewCount,
      trustScore: featured.trustScore,
      isVerified: featured.isVerified,
    },
  ],
  counts: {
    referralsReceived: 12,
    referralsSent: 7,
    referralsConverted: 5,
    leadsOpen: 4,
    reviewsTotal: featured.reviewCount,
  },
  recentLeads: [
    {
      id: 'lead-1',
      status: 'NEW',
      name: 'Anonymous (zip 63108)',
      eventType: 'home_purchase',
      createdAt: isoDaysAgo(1),
    },
    {
      id: 'lead-2',
      status: 'CONTACTED',
      name: 'Anonymous (zip 63110)',
      eventType: 'wedding',
      createdAt: isoDaysAgo(3),
    },
  ],
};

/**
 * Returns mock data for a given API path, or `undefined` if no mock exists.
 * Path matching ignores query string.
 */
export function getMockResponse(method: string, path: string): unknown {
  const m = method.toUpperCase();
  const url = path.split('?')[0] ?? path;

  if (m === 'GET') {
    if (url === '/api/v1/listings/recent' || url === '/api/v1/listings') {
      return MOCK_LISTINGS;
    }
    if (url === '/api/v1/categories') {
      return MOCK_CATEGORIES;
    }
    if (url.startsWith('/api/v1/listings/') && url.endsWith('/reviews')) {
      return MOCK_REVIEWS;
    }
    if (url.startsWith('/api/v1/listings/')) {
      const slug = url.replace('/api/v1/listings/', '');
      return MOCK_LISTINGS.find((l) => l.slug === slug) ?? MOCK_LISTINGS[0];
    }
    if (url === '/api/v1/dashboard/metrics') {
      return MOCK_DASHBOARD_METRICS;
    }
    if (url === '/api/v1/referrals/received' || url === '/api/v1/referrals/sent') {
      return [];
    }
    if (url === '/api/v1/consumer-leads/owner' || url === '/api/v1/consumer-leads/consumer') {
      return [];
    }
    if (url.startsWith('/api/v1/connect/')) {
      return MOCK_LISTINGS.slice(0, 6);
    }
  }

  if (m === 'POST') {
    if (url === '/api/v1/auth/signup' || url === '/api/v1/auth/login') {
      return {
        user: MOCK_DASHBOARD_METRICS.user,
        accessToken: 'demo-access-token',
        expiresIn: 900,
      };
    }
    if (url === '/api/v1/auth/refresh') {
      return { accessToken: 'demo-access-token', expiresIn: 900 };
    }
    // Generic ack for create/update mutations in demo mode
    return { ok: true, demo: true };
  }

  if (m === 'PATCH' || m === 'DELETE') {
    return { ok: true, demo: true };
  }

  return undefined;
}
