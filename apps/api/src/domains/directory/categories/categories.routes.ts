import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { listCategories } from './categories.service.js';

export const categoriesRouter: Router = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cats = await listCategories();
    const body: ApiResponse<typeof cats> = { success: true, data: cats };
    res.json(body);
  }),
);
