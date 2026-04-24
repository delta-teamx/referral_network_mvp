import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { eventBus } from '../../core/events/index.js';
import { sanitizeText } from '../../../utils/sanitize.js';

/**
 * Listings service — directory read/write.
 *
 * Writes are gated by RBAC permissions at the route layer (listing:create,
 * listing:update:own, listing:delete:own). Reads are public.
 */

export interface ListingListFilters {
  zipPrefix?: string;
  city?: string;
  state?: string;
  categorySlug?: string;
  categoryIds?: string[];
  minRating?: number;
  verifiedOnly?: boolean;
  query?: string;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'rating' | 'trust' | 'newest';
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 60;

/**
 * Paginated directory query. Uses pg_trgm similarity when `query` is
 * present; falls back to normal filters otherwise.
 */
export async function listListings(filters: ListingListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const where: Prisma.ListingWhereInput = {
    status: 'ACTIVE',
    deletedAt: null,
  };

  if (filters.zipPrefix) {
    where.zipCode = { startsWith: filters.zipPrefix };
  }
  if (filters.city) where.city = filters.city;
  if (filters.state) where.state = filters.state;
  if (filters.verifiedOnly) where.isVerified = true;
  if (filters.minRating !== undefined) where.avgRating = { gte: filters.minRating };

  if (filters.categorySlug) {
    const cat = await prisma.category.findUnique({ where: { slug: filters.categorySlug } });
    if (cat) where.categoryId = cat.id;
    else return { listings: [], total: 0, page, limit };
  } else if (filters.categoryIds?.length) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters.query && filters.query.trim().length >= 2) {
    const q = filters.query.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { shortDescription: { contains: q, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.ListingOrderByWithRelationInput[] =
    filters.sort === 'rating'
      ? [{ avgRating: 'desc' }, { reviewCount: 'desc' }]
      : filters.sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : [{ trustScore: 'desc' }, { avgRating: 'desc' }];

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: listingCardSelect,
    }),
    prisma.listing.count({ where }),
  ]);

  return { listings, total, page, limit };
}

export async function recentListings(limit = 6) {
  return prisma.listing.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
    select: listingCardSelect,
  });
}

export async function getListingBySlug(slug: string) {
  const listing = await prisma.listing.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      photos: { orderBy: { sortOrder: 'asc' } },
      tags: true,
      _count: { select: { reviews: true, referrals: true } },
    },
  });
  if (!listing) throw AppError.notFound('Listing not found');
  return listing;
}

export async function getListingReviews(slug: string, page = 1, limit = 10) {
  const listing = await prisma.listing.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!listing) throw AppError.notFound('Listing not found');

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { listingId: listing.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        rating: true,
        title: true,
        text: true,
        isVerified: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.review.count({ where: { listingId: listing.id, status: 'active' } }),
  ]);

  return { reviews, total, page, limit };
}

// ---- Writes ------------------------------------------------------------------

export interface CreateListingInput {
  categoryId: string;
  name: string;
  description: string;
  shortDescription?: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

/**
 * Generate a URL-safe slug from a name, falling back to a random suffix if
 * that slug is already taken.
 */
async function uniqueSlug(base: string): Promise<string> {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'listing';
  let slug = slugify(base);
  // eslint-disable-next-line no-constant-condition
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.listing.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${slugify(base)}-${Date.now()}`;
}

export async function createListing(userId: string, input: CreateListingInput) {
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) throw AppError.badRequest('Invalid category');

  const slug = await uniqueSlug(input.name);

  const listing = await prisma.listing.create({
    data: {
      userId,
      categoryId: category.id,
      slug,
      name: sanitizeText(input.name),
      description: sanitizeText(input.description),
      shortDescription: input.shortDescription ? sanitizeText(input.shortDescription) : null,
      address: sanitizeText(input.address),
      city: sanitizeText(input.city),
      state: input.state.toUpperCase(),
      zipCode: input.zipCode,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      // Approximate coordinates — listings don't yet prompt for geocoding; a
      // Branch 5 job backfills lat/lng via Google Maps geocoding.
      latitude: 38.627,
      longitude: -90.1994,
    },
    select: listingCardSelect,
  });

  await eventBus.publish('listing.created', { listingId: listing.id, userId });

  return listing;
}

export interface UpdateListingInput {
  name?: string;
  description?: string;
  shortDescription?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export async function updateOwnListing(
  listingId: string,
  userId: string,
  input: UpdateListingInput,
) {
  const existing = await prisma.listing.findFirst({
    where: { id: listingId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw AppError.notFound('Listing not found');

  const updated = await prisma.listing.update({
    where: { id: listingId, userId },
    data: input,
    select: listingCardSelect,
  });

  await eventBus.publish('listing.updated', { listingId: updated.id });
  return updated;
}

/** Slim projection used on every card. Keeps payloads small. */
const listingCardSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  city: true,
  state: true,
  zipCode: true,
  avgRating: true,
  reviewCount: true,
  trustScore: true,
  isVerified: true,
  isFeatured: true,
  logoUrl: true,
  coverPhotoUrl: true,
  createdAt: true,
  category: { select: { name: true, slug: true, icon: true } },
} satisfies Prisma.ListingSelect;
