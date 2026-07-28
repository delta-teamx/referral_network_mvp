import express, { Router } from 'express';
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
import {
  confirmPhotoUpload,
  confirmVideoUpload,
  presignPhotoUpload,
  presignVideoUpload,
  uploadProfilePhoto,
  uploadProfileVideo,
} from './video.service.js';

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

// Profile data is matching input, not a legal form: a save must never fail
// because a member typed a long paragraph or picked "too many" industries.
// Real onboarding users were dead-ending on step 3 with a bare "Validation
// failed" (e.g. >10 industries selected, or a 200+ char line in a textarea),
// so everything here CLAMPS - strings truncate, lists slice - instead of
// rejecting. Only genuinely required fields (business name, industry) and
// structural types can still fail.
const clip = (max: number) => z.string().trim().transform((s) => s.slice(0, max));
const clipList = (itemMax: number, listMax: number) =>
  z
    .array(z.string().trim().transform((s) => s.slice(0, itemMax)))
    .transform((list) => list.filter(Boolean).slice(0, listMax));
const roundedNumber = (min: number, max: number) =>
  z
    .number()
    .finite()
    .transform((n) => Math.min(max, Math.max(min, Math.round(n))));

const upsertSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').transform((s) => s.slice(0, 150)),
  industry: z.string().trim().min(1, 'Industry is required').transform((s) => s.slice(0, 80)),
  headline: clip(200).optional(),
  bio: clip(2000).optional(),
  photoUrl: z.string().url().optional(),
  keywords: clipList(50, 20).optional(),
  servicesOffered: clipList(100, 15).optional(),
  yearsInBusiness: roundedNumber(0, 150).optional(),
  // The industry pickers offer ~31 options and members may select them all.
  icpIndustries: clipList(80, 40).optional(),
  icpRoles: clipList(60, 15).optional(),
  icpProblems: clipList(300, 15).optional(),
  icpDealSize: clip(40).optional(),
  canReferIndustries: clipList(80, 40).optional(),
  canReferTypes: clipList(300, 15).optional(),
  city: clip(80).optional(),
  state: clip(2).optional(),
  zipCode: clip(10).optional(),
  serviceArea: z.enum(['local', 'remote', 'international']).optional(),
  serviceRadius: roundedNumber(1, 500).optional(),
  openToBarter: z.boolean().optional(),
  barterOfferings: clipList(100, 10).optional(),
  barterWants: clipList(100, 10).optional(),
  barterNotes: clip(500).optional(),
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

// Server-side uploads: the browser sends the file bytes to OUR API and the
// server puts them in S3 (region-healed). This replaced browser-to-S3
// presigned PUTs, which failed for real users on bucket CORS + region
// mismatch. The presign endpoints below stay only for older cached clients.
profilesRouter.post(
  '/photo/upload',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '9mb' }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (!Buffer.isBuffer(req.body)) {
      throw AppError.badRequest('Send the image file as the request body with its content type.');
    }
    const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    const result = await uploadProfilePhoto(req.user.id, contentType, req.body);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

profilesRouter.post(
  '/video/upload',
  express.raw({ type: 'video/*', limit: '101mb' }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (!Buffer.isBuffer(req.body)) {
      throw AppError.badRequest('Send the video file as the request body with its content type.');
    }
    const contentType = req.headers['content-type'] ?? '';
    const result = await uploadProfileVideo(req.user.id, contentType, req.body);
    const body: ApiResponse<typeof result> = { success: true, data: result };
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

const photoPresignSchema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

profilesRouter.post(
  '/photo/presign',
  validate(photoPresignSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await presignPhotoUpload(req.user.id, req.body.contentType, req.body.sizeBytes);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

const photoConfirmSchema = z.object({
  photoUrl: z.string().url(),
});

profilesRouter.post(
  '/photo/confirm',
  validate(photoConfirmSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await confirmPhotoUpload(req.user.id, req.body);
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
