import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  confirmPhoto,
  deletePhoto,
  listPhotos,
  presignPhotoUpload,
} from './photos.service.js';

export const photosRouter: Router = Router();

// Public — anyone can see a listing's gallery
photosRouter.get(
  '/:listingId',
  asyncHandler(async (req, res) => {
    const photos = await listPhotos(req.params.listingId ?? '');
    const body: ApiResponse<typeof photos> = { success: true, data: photos };
    res.json(body);
  }),
);

photosRouter.use(authenticate);

const presignSchema = z.object({
  listingId: z.string().uuid(),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

photosRouter.post(
  '/presign',
  validate(presignSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await presignPhotoUpload(
      req.user.id,
      req.body.listingId,
      req.body.contentType,
      req.body.sizeBytes,
    );
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

const confirmSchema = z.object({
  listingId: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
});

photosRouter.post(
  '/confirm',
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const photo = await confirmPhoto(req.user.id, req.body.listingId, {
      url: req.body.url,
      caption: req.body.caption,
      sortOrder: req.body.sortOrder,
    });
    const body: ApiResponse<typeof photo> = { success: true, data: photo };
    res.status(201).json(body);
  }),
);

photosRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await deletePhoto(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);
