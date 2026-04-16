/**
 * Life event types supported by the connector.
 * Keep the string values in sync with the `EventType` enum in Prisma schema.
 */
export const EVENT_TYPES = [
  'BUYING_HOUSE',
  'SELLING_HOUSE',
  'GETTING_MARRIED',
  'STARTING_BUSINESS',
  'HAVING_BABY',
  'PLANNING_FUNERAL',
  'HOME_RENOVATION',
  'PLANNING_RETIREMENT',
  'MOVING_TO_NEW_CITY',
  'HOSTING_EVENT',
  'GOING_TO_COLLEGE',
  'GETTING_DIVORCED',
  'OPENING_RESTAURANT',
  'CULTURAL_CELEBRATION',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventTypeMeta {
  type: EventType;
  label: string;
  description: string;
  icon: string;
}

export const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  BUYING_HOUSE: {
    type: 'BUYING_HOUSE',
    label: 'Buying a House',
    description: 'Find realtors, mortgage brokers, inspectors and movers.',
    icon: 'home',
  },
  SELLING_HOUSE: {
    type: 'SELLING_HOUSE',
    label: 'Selling a House',
    description: 'Realtors, stagers, photographers, contractors.',
    icon: 'home-sold',
  },
  GETTING_MARRIED: {
    type: 'GETTING_MARRIED',
    label: 'Getting Married',
    description: 'Planners, photographers, caterers, florists, venues.',
    icon: 'rings',
  },
  STARTING_BUSINESS: {
    type: 'STARTING_BUSINESS',
    label: 'Starting a Business',
    description: 'Accountants, lawyers, web designers, marketing.',
    icon: 'briefcase',
  },
  HAVING_BABY: {
    type: 'HAVING_BABY',
    label: 'Having a Baby',
    description: 'Pediatricians, doulas, photographers, childcare.',
    icon: 'baby',
  },
  PLANNING_FUNERAL: {
    type: 'PLANNING_FUNERAL',
    label: 'Planning a Funeral',
    description: 'Funeral homes, florists, caterers, counselors.',
    icon: 'candle',
  },
  HOME_RENOVATION: {
    type: 'HOME_RENOVATION',
    label: 'Home Renovation',
    description: 'Contractors, electricians, plumbers, designers.',
    icon: 'hammer',
  },
  PLANNING_RETIREMENT: {
    type: 'PLANNING_RETIREMENT',
    label: 'Planning Retirement',
    description: 'Financial planners, estate lawyers, advisors.',
    icon: 'tree',
  },
  MOVING_TO_NEW_CITY: {
    type: 'MOVING_TO_NEW_CITY',
    label: 'Moving to a New City',
    description: 'Movers, realtors, utility setup, local pros.',
    icon: 'truck',
  },
  HOSTING_EVENT: {
    type: 'HOSTING_EVENT',
    label: 'Hosting an Event',
    description: 'Caterers, rentals, DJs, photographers, venues.',
    icon: 'party',
  },
  GOING_TO_COLLEGE: {
    type: 'GOING_TO_COLLEGE',
    label: 'Going to College',
    description: 'Tutors, movers, financial aid, housing.',
    icon: 'graduation',
  },
  GETTING_DIVORCED: {
    type: 'GETTING_DIVORCED',
    label: 'Getting Divorced',
    description: 'Family lawyers, mediators, counselors, financial.',
    icon: 'gavel',
  },
  OPENING_RESTAURANT: {
    type: 'OPENING_RESTAURANT',
    label: 'Opening a Restaurant',
    description: 'Commercial contractors, suppliers, POS, licensing.',
    icon: 'chef',
  },
  CULTURAL_CELEBRATION: {
    type: 'CULTURAL_CELEBRATION',
    label: 'Cultural Celebration',
    description: 'Caterers, performers, venues, cultural specialists.',
    icon: 'flag',
  },
};
