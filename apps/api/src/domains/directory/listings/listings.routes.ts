import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  getListingBySlug,
  getListingReviews,
  listListings,
  recentListings,
} from './listings.service.js';

export const listingsRouter: Router = Router();

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
