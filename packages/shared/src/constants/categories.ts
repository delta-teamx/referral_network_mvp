/**
 * Seed list of business categories used by the directory. Full seed data
 * (including EventCategoryMap rows) is populated by Branch 3+ seed scripts.
 */
export interface CategorySeed {
  slug: string;
  name: string;
  icon?: string;
}

export const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { slug: 'realtor', name: 'Realtor', icon: 'home' },
  { slug: 'mortgage-broker', name: 'Mortgage Broker', icon: 'bank' },
  { slug: 'home-inspector', name: 'Home Inspector', icon: 'clipboard' },
  { slug: 'moving-company', name: 'Moving Company', icon: 'truck' },
  { slug: 'plumber', name: 'Plumber', icon: 'wrench' },
  { slug: 'electrician', name: 'Electrician', icon: 'bolt' },
  { slug: 'general-contractor', name: 'General Contractor', icon: 'hammer' },
  { slug: 'painter', name: 'Painter', icon: 'brush' },
  { slug: 'cleaner', name: 'Cleaning Service', icon: 'spray' },
  { slug: 'photographer', name: 'Photographer', icon: 'camera' },
  { slug: 'wedding-planner', name: 'Wedding Planner', icon: 'rings' },
  { slug: 'caterer', name: 'Caterer', icon: 'chef' },
  { slug: 'florist', name: 'Florist', icon: 'flower' },
  { slug: 'dj', name: 'DJ / Entertainment', icon: 'music' },
  { slug: 'accountant', name: 'Accountant / CPA', icon: 'calculator' },
  { slug: 'lawyer', name: 'Lawyer', icon: 'gavel' },
  { slug: 'insurance-agent', name: 'Insurance Agent', icon: 'shield' },
  { slug: 'web-designer', name: 'Web Designer / Developer', icon: 'code' },
  { slug: 'marketing-agency', name: 'Marketing Agency', icon: 'megaphone' },
  { slug: 'interior-designer', name: 'Interior Designer', icon: 'palette' },
  { slug: 'pediatrician', name: 'Pediatrician', icon: 'stethoscope' },
  { slug: 'financial-planner', name: 'Financial Planner', icon: 'chart' },
] as const;
