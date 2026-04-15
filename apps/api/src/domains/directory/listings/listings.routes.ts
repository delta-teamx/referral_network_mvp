import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  createListing,
  getListingBySlug,
  getListingReviews,
  listListings,
  recentListings,
  updateOwnListing,
} from './listings.service.js';

export const listingsRouter: Router = Router();

const createListingSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(10).max(5000),
  shortDescription: z.string().trim().max(255).optional(),
  address: z.string().trim().max(255),
  city: z.string().trim().max(80),
  state: z.string().trim().length(2),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional(),
  website: z.string().trim().url().optional(),
});

const updateListingSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  shortDescription: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().length(2).optional(),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/)
    .optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
});

listingsRouter.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit ?? 6)));
    const listings = await recentListings(limit);
    const body: ApiResponse<typeof listings> = { success: true, data: listings };
    res.json(body);
  }),
);

listingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const zip = typeof req.query.zip === 'string' ? req.query.zip.trim() : undefined;
    const result = await listListings({
      zipPrefix: zip && zip.length >= 3 ? zip.slice(0, 3) : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      categorySlug: typeof req.query.category === 'string' ? req.query.category : undefined,
      minRating: typeof req.query.minRating === 'string' ? Number(req.query.minRating) : undefined,
      verifiedOnly: req.query.verified === 'true',
      query: typeof req.query.q === 'string' ? req.query.q : undefined,
      page: typeof req.query.page === 'string' ? Number(req.query.page) : 1,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : 12,
      sort:
        req.query.sort === 'rating' ||
        req.query.sort === 'trust' ||
        req.query.sort === 'newest' ||
        req.query.sort === 'relevance'
          ? req.query.sort
          : undefined,
    });
    const body: ApiResponse<typeof result.listings> = {
      success: true,
      data: result.listings,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
    res.json(body);
  }),
);

listingsRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const listing = await getListingBySlug(req.params.slug ?? '');
    const body: ApiResponse<typeof listing> = { success: true, data: listing };
    res.json(body);
  }),
);

listingsRouter.get(
  '/:slug/reviews',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));
    const result = await getListingReviews(req.params.slug ?? '', page, limit);
    const body: ApiResponse<typeof result.reviews> = {
      success: true,
      data: result.reviews,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
    res.json(body);
  }),
);

listingsRouter.patch(
  '/:id',
  authenticate,
  validate(updateListingSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const listing = await updateOwnListing(req.params.id ?? '', req.user.id, req.body);
    const body: ApiResponse<typeof listing> = { success: true, data: listing };
    res.json(body);
  }),
);

listingsRouter.post(
  '/',
  authenticate,
  validate(createListingSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const listing = await createListing(req.user.id, req.body);
    const body: ApiResponse<typeof listing> = { success: true, data: listing };
    res.status(201).json(body);
  }),
);
