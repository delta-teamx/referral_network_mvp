import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { createReview } from './reviews.service.js';

export const reviewsRouter: Router = Router();

const createReviewSchema = z.object({
  listingSlug: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  text: z.string().trim().min(10).max(3000),
});

reviewsRouter.post(
  '/',
  authenticate,
  validate(createReviewSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const review = await createReview({ ...req.body, userId: req.user.id });
    const body: ApiResponse<typeof review> = { success: true, data: review };
    res.status(201).json(body);
  }),
);
