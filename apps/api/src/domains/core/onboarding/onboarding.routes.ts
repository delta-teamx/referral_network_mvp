import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { onboardingStartSchema, onboardingStepSchema } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  getOnboardingStatus,
  markStepCompleted,
  submitProfile,
  suggestConnections,
} from './onboarding.service.js';

export const onboardingRouter: Router = Router();

onboardingRouter.use(authenticate);

onboardingRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const status = await getOnboardingStatus(req.user.id);
    const body: ApiResponse<typeof status> = { success: true, data: status };
    res.json(body);
  }),
);

onboardingRouter.post(
  '/profile',
  validate(onboardingStartSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await submitProfile(req.user.id, req.body);
    const status = await getOnboardingStatus(req.user.id);
    const body: ApiResponse<typeof status> = { success: true, data: status };
    res.json(body);
  }),
);

onboardingRouter.post(
  '/step',
  validate(onboardingStepSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    await markStepCompleted(req.user.id, req.body.step);
    const status = await getOnboardingStatus(req.user.id);
    const body: ApiResponse<typeof status> = { success: true, data: status };
    res.json(body);
  }),
);

onboardingRouter.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const suggestions = await suggestConnections(req.user.id);
    const body: ApiResponse<typeof suggestions> = { success: true, data: suggestions };
    res.json(body);
  }),
);
