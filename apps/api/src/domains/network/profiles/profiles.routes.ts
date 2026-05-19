import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import {
  getMemberProfile,
  getPublicProfile,
  searchMembers,
  upsertMemberProfile,
} from './profiles.service.js';
import { confirmVideoUpload, presignVideoUpload } from './video.service.js';

export const profilesRouter: Router = Router();

profilesRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const filters = {
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      industry: typeof req.query.industry === 'string' ? req.query.industry : undefined,
      city: typeof req.query.city === 'string' ? req.query.city : undefined,
      state: typeof req.query.state === 'string' ? req.query.state : undefined,
      groupId: typeof req.query.groupId === 'string' ? req.query.groupId : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const profiles = await searchMembers(filters);
    const body: ApiResponse<typeof profiles> = { success: true, data: profiles };
    res.json(body);
  }),
);

profilesRouter.get(
  '/public/:id',
  asyncHandler(async (req, res) => {
    const profile = await getPublicProfile(req.params.id ?? '');
    const body: ApiResponse<typeof profile> = { success: true, data: profile };
    res.json(body);
  }),
);

profilesRouter.use(authenticate);

const upsertSchema = z.object({
  businessName: z.string().trim().min(1).max(150),
  industry: z.string().trim().min(1).max(80),
  headline: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
  photoUrl: z.string().url().optional(),
  keywords: z.array(z.string().trim().max(50)).max(20).optional(),
  servicesOffered: z.array(z.string().trim().max(100)).max(15).optional(),
  yearsInBusiness: z.number().int().min(0).max(150).optional(),
  icpIndustries: z.array(z.string().trim().max(80)).max(10).optional(),
  icpRoles: z.array(z.string().trim().max(60)).max(10).optional(),
  icpProblems: z.array(z.string().trim().max(200)).max(10).optional(),
  icpDealSize: z.string().trim().max(40).optional(),
  canReferIndustries: z.array(z.string().trim().max(80)).max(10).optional(),
  canReferTypes: z.array(z.string().trim().max(200)).max(10).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(2).optional(),
  zipCode: z.string().trim().max(10).optional(),
  serviceArea: z.enum(['local', 'remote', 'international']).optional(),
  serviceRadius: z.number().int().min(1).max(500).optional(),
  openToBarter: z.boolean().optional(),
  barterOfferings: z.array(z.string().trim().max(100)).max(10).optional(),
  barterWants: z.array(z.string().trim().max(100)).max(10).optional(),
  barterNotes: z.string().trim().max(500).optional(),
});

profilesRouter.post(
  '/',
  validate(upsertSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const profile = await upsertMemberProfile(req.user.id, req.body);
    const body: ApiResponse<typeof profile> = { success: true, data: profile };
    res.json(body);
  }),
);

profilesRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const profile = await getMemberProfile(req.user.id);
    const body: ApiResponse<typeof profile> = { success: true, data: profile };
    res.json(body);
  }),
);

const videoPresignSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

profilesRouter.post(
  '/video/presign',
  validate(videoPresignSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await presignVideoUpload(req.user.id, req.body.contentType, req.body.sizeBytes);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

const videoConfirmSchema = z.object({
  videoUrl: z.string().url(),
  videoKey: z.string().min(1),
  durationSec: z.number().int().positive().optional(),
  demo: z.boolean().optional(),
});

profilesRouter.post(
  '/video/confirm',
  validate(videoConfirmSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await confirmVideoUpload(req.user.id, req.body);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);
