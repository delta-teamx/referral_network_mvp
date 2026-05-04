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

const mockMemberProfile = (biz: string, ind: string, headline: string, city = 'St. Louis', openToBarter = false) => ({
  businessName: biz,
  industry: ind,
  headline,
  videoUrl: null as string | null,
  city,
  state: 'MO',
  openToBarter,
});

export const MOCK_AI_SUGGESTIONS = [
  {
    id: 'intro-1',
    reason:
      'Sarah works in Real Estate — an industry you want to connect with. She can refer clients to your business, and you can send her business.',
    matchScore: '82',
    status: 'suggested',
    createdAt: isoDaysAgo(1),
    sender: {
      id: 'demo-user',
      firstName: 'Demo',
      lastName: 'Owner',
      avatarUrl: null,
      memberProfile: mockMemberProfile('Demo Business', 'Consulting', 'AI referral demo'),
    },
    target: {
      id: 'user-sarah',
      firstName: 'Sarah',
      lastName: 'Johnson',
      avatarUrl: null,
      memberProfile: mockMemberProfile(
        'Johnson Realty Group',
        'Real Estate',
        '5th-generation St. Louis realtor — 200+ closings since 2018.',
        'St. Louis',
        true,
      ),
    },
  },
  {
    id: 'intro-2',
    reason:
      'Daniel is an Accountant looking for someone in your industry. He regularly refers clients to Insurance and Consulting businesses.',
    matchScore: '71',
    status: 'suggested',
    createdAt: isoDaysAgo(1),
    sender: {
      id: 'demo-user',
      firstName: 'Demo',
      lastName: 'Owner',
      avatarUrl: null,
      memberProfile: mockMemberProfile('Demo Business', 'Consulting', 'AI referral demo'),
    },
    target: {
      id: 'user-daniel',
      firstName: 'Daniel',
      lastName: 'Reyes',
      avatarUrl: null,
      memberProfile: mockMemberProfile(
        'Two Rivers CPA',
        'Accounting / CPA',
        'Small-business CPA — bookkeeping, taxes, payroll under one roof.',
        'Clayton',
      ),
    },
  },
  {
    id: 'intro-3',
    reason:
      'Maya plans weddings and is looking for vendors to expand her referral network. Based in your city.',
    matchScore: '64',
    status: 'requested',
    createdAt: isoDaysAgo(3),
    sender: {
      id: 'user-maya',
      firstName: 'Maya',
      lastName: 'Patel',
      avatarUrl: null,
      memberProfile: mockMemberProfile(
        'Stonegate Wedding Planning',
        'Wedding Planning',
        'Boutique wedding planning — 80+ weddings.',
      ),
    },
    target: {
      id: 'demo-user',
      firstName: 'Demo',
      lastName: 'Owner',
      avatarUrl: null,
      memberProfile: mockMemberProfile('Demo Business', 'Consulting', 'AI referral demo'),
    },
  },
];

export const MOCK_EVENTS = [
  {
    id: 'evt-1',
    title: 'Tuesday Morning Referrals',
    description:
      'Weekly 60-minute Zoom for pros to swap warm leads. Bring one referral-ready client you want to find a match for.',
    startsAt: new Date(Date.now() + 2 * 86400_000).toISOString(),
    durationMin: 60,
    zoomUrl: 'https://zoom.us/j/1234567890?pwd=demo',
    maxAttendees: 50,
    status: 'scheduled',
    isRecurring: true,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU',
    _count: { registrations: 18 },
  },
  {
    id: 'evt-2',
    title: 'Expert Panel: Closing Referral Loops',
    description:
      '3 top-earning members share exactly how they convert intros into closed deals. Live Q&A at the end.',
    startsAt: new Date(Date.now() + 9 * 86400_000).toISOString(),
    durationMin: 75,
    zoomUrl: 'https://zoom.us/j/1234567891?pwd=demo',
    maxAttendees: 100,
    status: 'scheduled',
    isRecurring: false,
    recurrenceRule: null,
    _count: { registrations: 42 },
  },
  {
    id: 'evt-3',
    title: 'STL Wedding Vendors Meetup',
    description: 'Planners, photographers, caterers, florists — monthly virtual coffee.',
    startsAt: new Date(Date.now() + 14 * 86400_000).toISOString(),
    durationMin: 45,
    zoomUrl: 'https://zoom.us/j/1234567892?pwd=demo',
    maxAttendees: 30,
    status: 'scheduled',
    isRecurring: true,
    recurrenceRule: 'FREQ=MONTHLY;BYDAY=1TH',
    _count: { registrations: 12 },
  },
];

export const MOCK_BOOKINGS = [
  {
    id: 'bk-1',
    reason: 'referral',
    notes: 'Have a client looking for a roofer — want to see if you\u2019re a fit.',
    startsAt: new Date(Date.now() + 2 * 86400_000 + 10 * 3600_000).toISOString(),
    endsAt: new Date(Date.now() + 2 * 86400_000 + 10.5 * 3600_000).toISOString(),
    status: 'confirmed',
    zoomUrl: 'https://zoom.us/j/9876543210?pwd=demo',
    zoomMeetingId: '9876543210',
    createdAt: isoDaysAgo(1),
    host: {
      id: 'demo-user',
      firstName: 'Demo',
      lastName: 'Owner',
      email: 'demo@virtualprosnetwork.app',
      memberProfile: { businessName: 'Demo Business', industry: 'Consulting' },
    },
    guest: {
      id: 'user-sarah',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah@johnsonrealty.com',
      memberProfile: { businessName: 'Johnson Realty Group', industry: 'Real Estate' },
    },
  },
];

export const MOCK_GROUPS = [
  {
    id: 'grp-1',
    slug: 'stl-realtors-network',
    name: 'STL Realtors + Home Services',
    description:
      'Weekly coffee meetup for realtors, inspectors, mortgage brokers, and home-services pros.',
    city: 'St. Louis',
    state: 'MO',
    meetingSchedule: 'Every Tuesday 7am at Kaldi\u2019s Demun',
    memberCount: 18,
    maxMembers: 30,
    isPublic: true,
  },
  {
    id: 'grp-2',
    slug: 'stl-wedding-pros',
    name: 'Wedding Pros of St. Louis',
    description: 'Photographers, planners, caterers, DJs, florists — one seat each.',
    city: 'St. Louis',
    state: 'MO',
    meetingSchedule: 'First Wednesday of the month · virtual',
    memberCount: 12,
    maxMembers: 20,
    isPublic: true,
  },
  {
    id: 'grp-3',
    slug: 'clayton-pro-circle',
    name: 'Clayton Professional Circle',
    description: 'Lawyers, CPAs, financial planners, insurance brokers. Invite only.',
    city: 'Clayton',
    state: 'MO',
    meetingSchedule: 'Every other Thursday 5:30pm',
    memberCount: 14,
    maxMembers: 24,
    isPublic: false,
  },
  {
    id: 'grp-4',
    slug: 'chesterfield-home-builders',
    name: 'Chesterfield Home Builders',
    description: 'Contractors, architects, interior designers, landscapers.',
    city: 'Chesterfield',
    state: 'MO',
    meetingSchedule: 'Monthly, second Monday',
    memberCount: 9,
    maxMembers: 25,
    isPublic: true,
  },
];

export const MOCK_CONNECTIONS = [
  {
    id: 'conn-1',
    status: 'accepted',
    direction: 'outbound',
    strengthScore: '74.5',
    createdAt: isoDaysAgo(45),
    acceptedAt: isoDaysAgo(44),
    lastInteractAt: isoDaysAgo(5),
    peer: {
      id: 'user-1',
      firstName: 'Daniel',
      lastName: 'Reyes',
      email: 'daniel@tworiverscpa.com',
      avatarUrl: null,
    },
  },
  {
    id: 'conn-2',
    status: 'accepted',
    direction: 'inbound',
    strengthScore: '68.2',
    createdAt: isoDaysAgo(30),
    acceptedAt: isoDaysAgo(29),
    lastInteractAt: isoDaysAgo(8),
    peer: {
      id: 'user-2',
      firstName: 'Maya',
      lastName: 'Patel',
      email: 'maya@stonegateweddings.com',
      avatarUrl: null,
    },
  },
  {
    id: 'conn-3',
    status: 'pending',
    direction: 'inbound',
    strengthScore: '0',
    createdAt: isoDaysAgo(2),
    acceptedAt: null,
    lastInteractAt: null,
    peer: {
      id: 'user-3',
      firstName: 'Emma',
      lastName: 'Chen',
      email: 'emma@bloomphoto.com',
      avatarUrl: null,
    },
  },
];

export const MOCK_INVITATIONS = [
  {
    id: 'inv-1',
    recipientEmail: 'karen@gatewayfamilylaw.com',
    message: "We've been sending each other referrals for months — let's make it official.",
    status: 'pending',
    expiresAt: new Date(Date.now() + 12 * 86400_000).toISOString(),
    createdAt: isoDaysAgo(2),
    token: 'demo-token-1',
  },
];

export const MOCK_PUBLIC_INVITE = {
  id: 'demo-token-1',
  recipientEmail: 'friend@example.com',
  message: 'Hey — you\u2019d be a great fit for our referral network.',
  status: 'pending' as const,
  expiresAt: new Date(Date.now() + 12 * 86400_000).toISOString(),
  sender: {
    firstName: 'Sarah',
    lastName: 'Johnson',
    listing: {
      name: 'Johnson Realty Group',
      slug: 'johnson-realty-group',
      city: 'St. Louis',
      state: 'MO',
    },
  },
};

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
    email: 'demo@virtualprosnetwork.app',
    role: 'ADMIN',
    subscriptionTier: 'PRO',
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
    if (url === '/api/v1/ai/suggestions') {
      return MOCK_AI_SUGGESTIONS;
    }
    if (url === '/api/v1/ai/matches') {
      return MOCK_AI_SUGGESTIONS.map((s) => ({
        targetUserId: s.target.id,
        score: Number(s.matchScore),
        reason: s.reason,
        factors: {},
      }));
    }
    if (url === '/api/v1/ai/history') {
      return [];
    }
    if (url === '/api/v1/profiles/me') {
      return {
        id: 'profile-demo',
        userId: 'demo-user',
        businessName: 'Demo Business',
        industry: 'Consulting',
        headline: 'AI-powered referral network demo',
        bio: null,
        keywords: ['consulting', 'networking'],
        servicesOffered: ['Business consulting'],
        yearsInBusiness: null,
        icpIndustries: ['real estate', 'insurance'],
        icpRoles: ['agent', 'broker'],
        icpProblems: [],
        icpDealSize: null,
        canReferIndustries: ['accounting', 'law'],
        canReferTypes: ['Small business owners'],
        videoUrl: null,
        videoTranscript: null,
        videoProcessed: false,
        city: 'St. Louis',
        state: 'MO',
        zipCode: '63108',
        openToBarter: false,
        barterOfferings: [],
        barterWants: [],
        barterNotes: null,
        createdAt: isoDaysAgo(30),
        updatedAt: isoDaysAgo(2),
      };
    }
    if (url === '/api/v1/profiles/search') {
      return [];
    }
    if (url === '/api/v1/dashboard/metrics') {
      return MOCK_DASHBOARD_METRICS;
    }
    if (url === '/api/v1/dashboard/analytics') {
      const labels = Array.from({ length: 12 }, (_, i) => `W-${11 - i}`);
      return {
        labels,
        series: {
          leads: [2, 3, 1, 4, 5, 3, 7, 6, 8, 7, 10, 12],
          leadsConverted: [0, 1, 1, 2, 2, 1, 3, 2, 4, 3, 4, 5],
          referrals: [1, 2, 1, 2, 3, 2, 4, 3, 5, 4, 6, 7],
          referralsConverted: [0, 1, 0, 1, 2, 1, 2, 1, 3, 2, 3, 4],
          reviews: [1, 2, 0, 3, 2, 3, 1, 4, 2, 3, 5, 6],
        },
        ratings: {
          avg: 4.7,
          count: 32,
          distribution: [
            { star: 1, count: 0 },
            { star: 2, count: 1 },
            { star: 3, count: 2 },
            { star: 4, count: 9 },
            { star: 5, count: 20 },
          ],
        },
      };
    }
    if (url === '/api/v1/referrals/received' || url === '/api/v1/referrals/sent') {
      return [];
    }
    if (url === '/api/v1/consumer-leads/owner' || url === '/api/v1/consumer-leads/consumer' || url === '/api/v1/consumer-leads/received') {
      return [];
    }
    if (url.startsWith('/api/v1/connect/')) {
      return MOCK_LISTINGS.slice(0, 6);
    }
    if (url === '/api/v1/connections') {
      return MOCK_CONNECTIONS;
    }
    if (url === '/api/v1/groups' || url === '/api/v1/groups/mine') {
      return MOCK_GROUPS;
    }
    if (url === '/api/v1/events/upcoming') {
      return MOCK_EVENTS;
    }
    if (url === '/api/v1/events/me/registrations') {
      return [];
    }
    if (url === '/api/v1/events/admin/all') {
      return MOCK_EVENTS;
    }
    if (url === '/api/v1/bookings/mine' || url.startsWith('/api/v1/bookings/mine?')) {
      return MOCK_BOOKINGS;
    }
    if (url === '/api/v1/bookings/my-availability') {
      return [
        { id: 'a1', dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60 },
        { id: 'a2', dayOfWeek: 3, startMin: 14 * 60, endMin: 17 * 60 },
      ];
    }
    if (url.startsWith('/api/v1/bookings/availability/')) {
      const slots: Array<{ startsAt: string; endsAt: string }> = [];
      const base = new Date();
      base.setHours(10, 0, 0, 0);
      for (let d = 1; d <= 5; d++) {
        for (let t = 0; t < 6; t++) {
          const s = new Date(base.getTime() + d * 86400_000 + t * 30 * 60_000);
          slots.push({
            startsAt: s.toISOString(),
            endsAt: new Date(s.getTime() + 30 * 60_000).toISOString(),
          });
        }
      }
      return slots;
    }
    if (url === '/api/v1/billing/plans') {
      return [
        {
          tier: 'FREE',
          name: 'Free',
          pricePerMonthCents: 0,
          maxLeadsPerMonth: 3,
          maxListings: 1,
          prioritizedInRanking: false,
          canSeeRankingDetails: false,
        },
        {
          tier: 'PRO',
          name: 'Pro',
          pricePerMonthCents: 4900,
          maxLeadsPerMonth: 30,
          maxListings: 3,
          prioritizedInRanking: false,
          canSeeRankingDetails: true,
        },
        {
          tier: 'PREMIUM',
          name: 'Premium',
          pricePerMonthCents: 14900,
          maxLeadsPerMonth: null,
          maxListings: 10,
          prioritizedInRanking: true,
          canSeeRankingDetails: true,
        },
      ];
    }
    if (url === '/api/v1/billing/quota') {
      return { allowed: true, used: 1, cap: 3, tier: 'FREE' };
    }
    if (url === '/api/v1/admin/overview') {
      return {
        counts: {
          users: 184,
          listings: 42,
          leads: 128,
          referrals: 67,
          groups: 8,
          pendingListings: 3,
        },
        tierBreakdown: { FREE: 142, PRO: 31, PREMIUM: 11 },
      };
    }
    if (url === '/api/v1/admin/users') {
      return {
        users: [
          {
            id: 'u1',
            email: 'sarah@johnsonrealty.com',
            firstName: 'Sarah',
            lastName: 'Johnson',
            role: 'BUSINESS_OWNER',
            subscriptionTier: 'PRO',
            emailVerified: true,
            createdAt: isoDaysAgo(120),
            _count: { listings: 1, referralsSent: 14 },
          },
          {
            id: 'u2',
            email: 'daniel@tworiverscpa.com',
            firstName: 'Daniel',
            lastName: 'Reyes',
            role: 'BUSINESS_OWNER',
            subscriptionTier: 'FREE',
            emailVerified: true,
            createdAt: isoDaysAgo(85),
            _count: { listings: 1, referralsSent: 6 },
          },
          {
            id: 'u3',
            email: 'maya@stonegateweddings.com',
            firstName: 'Maya',
            lastName: 'Patel',
            role: 'BUSINESS_OWNER',
            subscriptionTier: 'PREMIUM',
            emailVerified: true,
            createdAt: isoDaysAgo(200),
            _count: { listings: 1, referralsSent: 23 },
          },
        ],
        total: 184,
        page: 1,
        limit: 50,
      };
    }
    if (url === '/api/v1/admin/listings') {
      return {
        listings: MOCK_LISTINGS.slice(0, 6).map((l) => ({
          id: l.id,
          slug: l.slug,
          name: l.name,
          city: l.city,
          state: l.state,
          status: 'ACTIVE',
          isVerified: l.isVerified,
          isFeatured: l.isFeatured,
          avgRating: l.avgRating,
          reviewCount: l.reviewCount,
          trustScore: l.trustScore,
          createdAt: isoDaysAgo(30),
          user: { email: 'owner@example.com', firstName: 'Owner', lastName: 'Name' },
        })),
        total: 42,
        page: 1,
        limit: 50,
      };
    }
    if (url === '/api/v1/admin/listings/pending') {
      return [
        {
          id: 'pend-1',
          slug: 'summit-legal-partners',
          name: 'Summit Legal Partners',
          city: 'St. Louis',
          state: 'MO',
          createdAt: isoDaysAgo(1),
          user: {
            id: 'u-new',
            email: 'intake@summitlegal.com',
            firstName: 'Karen',
            lastName: 'Vasquez',
          },
          category: { name: 'Lawyer', slug: 'lawyer' },
        },
      ];
    }
    if (url === '/api/v1/admin/groups') {
      return MOCK_GROUPS.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        city: g.city,
        state: g.state,
        status: 'active',
        maxMembers: g.maxMembers,
        _count: { members: g.memberCount },
      }));
    }
    if (url.startsWith('/api/v1/photos/')) {
      return [
        {
          id: 'photo-1',
          url: 'https://picsum.photos/seed/refnet1/1200/800',
          caption: null,
          sortOrder: 0,
        },
        {
          id: 'photo-2',
          url: 'https://picsum.photos/seed/refnet2/1200/800',
          caption: null,
          sortOrder: 1,
        },
      ];
    }
    if (url === '/api/v1/pods') {
      return [];
    }
    if (url.startsWith('/api/v1/connections/state/')) {
      return { state: 'none' };
    }
    if (url === '/api/v1/invitations/sent') {
      return MOCK_INVITATIONS;
    }
    if (url === '/api/v1/messages' || url === '/api/v1/messages/conversations') {
      return [];
    }
    if (url.startsWith('/api/v1/invitations/public/')) {
      const token = url.replace('/api/v1/invitations/public/', '');
      return { ...MOCK_PUBLIC_INVITE, id: token };
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
    if (url === '/api/v1/billing/checkout') {
      return { url: '/billing/success?tier=PRO&demo=1', demo: true };
    }
    if (url === '/api/v1/photos/presign') {
      return {
        uploadUrl: 'demo://skip-upload',
        publicUrl: `https://picsum.photos/seed/${Date.now()}/1200/800`,
        key: 'demo',
        demo: true,
      };
    }
    // Generic ack for create/update mutations in demo mode
    return { ok: true, demo: true };
  }

  if (m === 'PATCH' || m === 'DELETE') {
    return { ok: true, demo: true };
  }

  return undefined;
}
