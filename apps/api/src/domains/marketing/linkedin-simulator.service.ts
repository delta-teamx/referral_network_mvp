import { ingestProspect, advanceProspect, type ProspectStatus } from './linkedin-prospects.service.js';
import { prisma } from '../../config/prisma.js';

/**
 * Feature 3 demo helper. Without a real Dripify integration we have no
 * way to populate the pipeline for a sales demo, so this service does
 * two things admins can trigger from the pipeline UI:
 *
 *   - seedSampleProspects: ingest a fixed set of 20 realistic prospects
 *     so the pipeline UI is populated. Idempotent (upserts by URL).
 *   - simulateOutreachStep: walks a random subset of prospects one
 *     status forward, with realistic outcomes (some declined, some
 *     drop out). Lets the demo show pipeline movement over time.
 *
 * Both are admin-only and clearly labeled as simulator output (source =
 * "simulator") so a real Dripify integration coming online later will
 * not be confused with seed data.
 */

const SAMPLE_PROSPECTS = [
  {
    fullName: 'Maria Chen',
    headline: 'Founder · Chen Family Insurance | BNI chapter leader',
    linkedInUrl: 'https://www.linkedin.com/in/maria-chen-insurance-demo',
    industry: 'Insurance',
    jobRole: 'Owner',
    location: 'Phoenix, AZ, United States',
    city: 'Phoenix',
    state: 'AZ',
    country: 'US',
  },
  {
    fullName: 'Devon Park',
    headline: 'Senior Escrow Officer · Park Title',
    linkedInUrl: 'https://www.linkedin.com/in/devon-park-title-demo',
    industry: 'Real Estate',
    jobRole: 'Account Executive',
    location: 'Phoenix, AZ, United States',
    city: 'Phoenix',
    state: 'AZ',
    country: 'US',
  },
  {
    fullName: 'Priya Sharma',
    headline: 'Managing Partner · Sharma Wealth Strategies',
    linkedInUrl: 'https://www.linkedin.com/in/priya-sharma-wealth-demo',
    industry: 'Financial Advisory',
    jobRole: 'Managing Partner',
    location: 'Scottsdale, AZ, United States',
    city: 'Scottsdale',
    state: 'AZ',
    country: 'US',
  },
  {
    fullName: 'Sam Whitfield',
    headline: 'CEO · Whitfield Marketing | networking group host',
    linkedInUrl: 'https://www.linkedin.com/in/sam-whitfield-mkt-demo',
    industry: 'Marketing',
    jobRole: 'CEO',
    location: 'Mesa, AZ, United States',
    city: 'Mesa',
    state: 'AZ',
    country: 'US',
  },
  {
    fullName: 'Rachel Goldstein',
    headline: 'Principal Attorney · Goldstein Family Law',
    linkedInUrl: 'https://www.linkedin.com/in/rachel-goldstein-law-demo',
    industry: 'Legal Services',
    jobRole: 'Principal',
    location: 'Austin, TX, United States',
    city: 'Austin',
    state: 'TX',
    country: 'US',
  },
  {
    fullName: 'Marcus Lee',
    headline: 'Mortgage Broker · Lee Lending Co.',
    linkedInUrl: 'https://www.linkedin.com/in/marcus-lee-mortgage-demo',
    industry: 'Mortgage',
    jobRole: 'Broker Owner',
    location: 'Houston, TX, United States',
    city: 'Houston',
    state: 'TX',
    country: 'US',
  },
  {
    fullName: 'Elena Vasquez',
    headline: 'Founder · Vasquez CPA | tax & advisory',
    linkedInUrl: 'https://www.linkedin.com/in/elena-vasquez-cpa-demo',
    industry: 'Accounting',
    jobRole: 'Founder',
    location: 'San Diego, CA, United States',
    city: 'San Diego',
    state: 'CA',
    country: 'US',
  },
  {
    fullName: 'James O’Brien',
    headline: 'Owner · O’Brien Roofing & Construction',
    linkedInUrl: 'https://www.linkedin.com/in/james-obrien-roofing-demo',
    industry: 'Construction',
    jobRole: 'Owner',
    location: 'Denver, CO, United States',
    city: 'Denver',
    state: 'CO',
    country: 'US',
  },
  {
    fullName: 'Aaliyah Thompson',
    headline: 'Realtor · Thompson Group | NAR top producer',
    linkedInUrl: 'https://www.linkedin.com/in/aaliyah-thompson-realty-demo',
    industry: 'Real Estate',
    jobRole: 'Realtor',
    location: 'Atlanta, GA, United States',
    city: 'Atlanta',
    state: 'GA',
    country: 'US',
  },
  {
    fullName: 'Thomas Becker',
    headline: 'CEO · Becker Home Services',
    linkedInUrl: 'https://www.linkedin.com/in/thomas-becker-home-demo',
    industry: 'Home Services',
    jobRole: 'CEO',
    location: 'Tampa, FL, United States',
    city: 'Tampa',
    state: 'FL',
    country: 'US',
  },
  {
    fullName: 'Nadia Rashid',
    headline: 'Senior Wealth Advisor · Rashid Capital',
    linkedInUrl: 'https://www.linkedin.com/in/nadia-rashid-wealth-demo',
    industry: 'Wealth Management',
    jobRole: 'Senior Advisor',
    location: 'New York, NY, United States',
    city: 'New York',
    state: 'NY',
    country: 'US',
  },
  {
    fullName: 'Brian Foster',
    headline: 'Insurance Broker · Foster & Associates',
    linkedInUrl: 'https://www.linkedin.com/in/brian-foster-ins-demo',
    industry: 'Insurance',
    jobRole: 'Broker',
    location: 'Chicago, IL, United States',
    city: 'Chicago',
    state: 'IL',
    country: 'US',
  },
  {
    fullName: 'Sofia Hernandez',
    headline: 'Founder · Hernandez Marketing | speaker',
    linkedInUrl: 'https://www.linkedin.com/in/sofia-hernandez-mkt-demo',
    industry: 'Marketing',
    jobRole: 'Founder',
    location: 'Miami, FL, United States',
    city: 'Miami',
    state: 'FL',
    country: 'US',
  },
  {
    fullName: 'Kevin Walsh',
    headline: 'Managing Director · Walsh Mortgage',
    linkedInUrl: 'https://www.linkedin.com/in/kevin-walsh-mortgage-demo',
    industry: 'Mortgage',
    jobRole: 'Managing Director',
    location: 'Boston, MA, United States',
    city: 'Boston',
    state: 'MA',
    country: 'US',
  },
  {
    fullName: 'Linh Tran',
    headline: 'Estate Attorney · Tran Legal',
    linkedInUrl: 'https://www.linkedin.com/in/linh-tran-legal-demo',
    industry: 'Legal Services',
    jobRole: 'Partner',
    location: 'Seattle, WA, United States',
    city: 'Seattle',
    state: 'WA',
    country: 'US',
  },
  {
    fullName: 'Diego Morales',
    headline: 'Home Inspector · Morales Inspections',
    linkedInUrl: 'https://www.linkedin.com/in/diego-morales-insp-demo',
    industry: 'Home Services',
    jobRole: 'Owner',
    location: 'Las Vegas, NV, United States',
    city: 'Las Vegas',
    state: 'NV',
    country: 'US',
  },
  {
    fullName: 'Chloe Wright',
    headline: 'Realtor · Wright Realty',
    linkedInUrl: 'https://www.linkedin.com/in/chloe-wright-realty-demo',
    industry: 'Real Estate',
    jobRole: 'Realtor',
    location: 'Nashville, TN, United States',
    city: 'Nashville',
    state: 'TN',
    country: 'US',
  },
  {
    fullName: 'Andre Robinson',
    headline: 'Founder · Robinson Construction',
    linkedInUrl: 'https://www.linkedin.com/in/andre-robinson-build-demo',
    industry: 'Construction',
    jobRole: 'Founder',
    location: 'Charlotte, NC, United States',
    city: 'Charlotte',
    state: 'NC',
    country: 'US',
  },
  {
    fullName: 'Yuki Tanaka',
    headline: 'CPA · Tanaka Accounting',
    linkedInUrl: 'https://www.linkedin.com/in/yuki-tanaka-cpa-demo',
    industry: 'Accounting',
    jobRole: 'Partner',
    location: 'Portland, OR, United States',
    city: 'Portland',
    state: 'OR',
    country: 'US',
  },
  {
    fullName: 'Olivia Bennett',
    headline: 'Insurance Agent · Bennett Risk',
    linkedInUrl: 'https://www.linkedin.com/in/olivia-bennett-ins-demo',
    industry: 'Insurance',
    jobRole: 'Sales',
    location: 'Minneapolis, MN, United States',
    city: 'Minneapolis',
    state: 'MN',
    country: 'US',
  },
];

export async function seedSampleProspects(): Promise<{ ingested: number }> {
  let ingested = 0;
  for (const p of SAMPLE_PROSPECTS) {
    await ingestProspect({ ...p, email: synthesizeEmail(p.fullName), source: 'simulator' });
    ingested++;
  }
  return { ingested };
}

function synthesizeEmail(fullName: string): string {
  const slug = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${slug}@example-demo.test`;
}

const STATUS_PROGRESSION: Record<ProspectStatus, ProspectStatus | null> = {
  identified: 'connection_sent',
  connection_sent: 'connected',
  connected: 'invited',
  invited: 'attended',
  attended: 'converted',
  converted: null,
  declined: null,
};

const DROP_OFF_RATE: Record<ProspectStatus, number> = {
  identified: 0.1,
  connection_sent: 0.2,
  connected: 0.15,
  invited: 0.2,
  attended: 0.15,
  converted: 0,
  declined: 0,
};

export interface SimulateResult {
  advanced: number;
  dropped: number;
  stuck: number;
}

export async function simulateOutreachStep(): Promise<SimulateResult> {
  const rows = await prisma.linkedInProspect.findMany({
    where: { status: { notIn: ['converted', 'declined'] } },
    select: { id: true, status: true },
  });

  let advanced = 0;
  let dropped = 0;
  let stuck = 0;

  for (const row of rows) {
    const status = row.status as ProspectStatus;
    const next = STATUS_PROGRESSION[status];
    if (!next) {
      stuck++;
      continue;
    }
    // Random walk: ~30% stuck this cycle, configured drop-off → declined, else advance.
    const dice = Math.random();
    if (dice < DROP_OFF_RATE[status]) {
      await advanceProspect(row.id, 'declined', 'Simulated drop-off');
      dropped++;
    } else if (dice < 0.4) {
      stuck++;
    } else {
      await advanceProspect(row.id, next, `Simulator advanced from ${status}`);
      advanced++;
    }
  }

  return { advanced, dropped, stuck };
}
