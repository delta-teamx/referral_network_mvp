import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import {
  adminOverview,
  approveListing,
  archiveGroup,
  hardDeleteGroup,
  featureListing,
  impersonateUser,
  listAllGroups,
  listAllListings,
  listAllUsers,
  listPendingListings,
  rejectListing,
  sendAdminMessage,
  setUserRole,
  setUserTier,
  hardDeleteUser,
  suspendUser,
} from './admin.service.js';
import {
  adminReplyAsRoul,
  getOfficialThread,
  listOfficialConversations,
} from '../network/messaging/messaging.service.js';
import {
  getContributionPoints,
  getFreeEngagementLimit,
  setContributionPoints,
  setFreeEngagementLimit,
} from '../core/settings/settings.service.js';
import { adjustMemberPoints } from '../network/referral-tracking/contribution.service.js';
import { getRewardCatalog, setRewardCatalog } from '../network/rewards/rewards.service.js';
import {
  adminOverrideReferral,
  listDisputedReferrals,
} from '../network/referrals/referrals.service.js';
import { computeReferralAnalytics, getSpamSuspects, getUserActivity } from './analytics.service.js';

export const adminRouter: Router = Router();
adminRouter.use(authenticate);

// Coarse-grained gate - the RBAC permission middleware can lock specific
// endpoints down further; this stops any non-ADMIN from probing the router.
adminRouter.use((req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'ADMIN') return next(AppError.forbidden('Admin role required'));
  return next();
});

adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const data = await adminOverview();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Run (or dry-run) the re-engagement sweep on demand. dryRun returns who WOULD
// be emailed without sending; omit it to send for real.
const reengageSchema = z.object({ dryRun: z.boolean().optional() });
adminRouter.post(
  '/reengagement',
  validate(reengageSchema),
  asyncHandler(async (req, res) => {
    const { runReengagementSweep } = await import('../core/notifications/reengagement.service.js');
    const result = await runReengagementSweep({ dryRun: req.body.dryRun === true });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Run (or dry-run) the 24h profile-completion reminder sweep on demand.
adminRouter.post(
  '/profile-reminders',
  validate(reengageSchema),
  asyncHandler(async (req, res) => {
    const { runProfileCompletionReminders } = await import(
      '../core/notifications/reengagement.service.js'
    );
    const result = await runProfileCompletionReminders({ dryRun: req.body.dryRun === true });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Send one of every email template (branded redesign) to an address for review.
const previewSchema = z.object({ to: z.string().email() });
adminRouter.post(
  '/email-previews',
  validate(previewSchema),
  asyncHandler(async (req, res) => {
    const { sendTemplatePreviews } = await import('../core/notifications/email.service.js');
    const sent = await sendTemplatePreviews(req.body.to);
    const body: ApiResponse<{ sent: string[] }> = { success: true, data: { sent } };
    res.json(body);
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listAllUsers(page, limit, q);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const roleSchema = z.object({
  role: z.enum(['CONSUMER', 'BUSINESS_OWNER', 'GROUP_LEADER', 'CITY_CAPTAIN', 'ADMIN']),
});
adminRouter.post(
  '/users/:id/role',
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You cannot change your own role.');
    }
    const data = await setUserRole(req.user.id, req.params.id ?? '', req.body.role);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const tierSchema = z.object({ tier: z.enum(['FREE', 'PRO', 'PREMIUM']) });
adminRouter.post(
  '/users/:id/tier',
  validate(tierSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await setUserTier(req.user.id, req.params.id ?? '', req.body.tier);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Direct admin -> member message (ROUL note in their inbox). For reminders and
// direct support; never added to pipelines. Reaches every member (all plans).
const adminMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message is required').max(2000),
  title: z.string().trim().max(120).optional(),
});
adminRouter.post(
  '/users/:id/message',
  validate(adminMessageSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await sendAdminMessage(
      req.user.id,
      req.params.id ?? '',
      req.body.text,
      req.body.title,
    );
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ── ROUL Support: admin-facing member message threads (Messages tab) ──────────
adminRouter.get(
  '/roul-threads',
  asyncHandler(async (_req, res) => {
    const data = await listOfficialConversations();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/roul-threads/:id',
  asyncHandler(async (req, res) => {
    const data = await getOfficialThread(req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const roulReplySchema = z.object({ text: z.string().trim().min(1).max(5000) });
adminRouter.post(
  '/roul-threads/:id/reply',
  validate(roulReplySchema),
  asyncHandler(async (req, res) => {
    const data = await adminReplyAsRoul(req.params.id ?? '', req.body.text);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Referral + rewards funnel analytics.
adminRouter.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const data = await computeReferralAnalytics();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Rule-based spam suspects (flags only - admin reviews and acts).
adminRouter.get(
  '/spam-suspects',
  asyncHandler(async (_req, res) => {
    const data = await getSpamSuspects();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// One member's activity snapshot (per-user "keep an eye on everyone" view).
adminRouter.get(
  '/users/:id/activity',
  asyncHandler(async (req, res) => {
    const data = await getUserActivity(req.params.id ?? '');
    if (!data) throw AppError.notFound('User not found');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// ── Rewards & Points config (Phase 2) ────────────────────────────────────────
adminRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const [contributionPoints, freeEngagementLimit, rewardCatalog] = await Promise.all([
      getContributionPoints(),
      getFreeEngagementLimit(),
      getRewardCatalog(),
    ]);
    const data = { contributionPoints, freeEngagementLimit, rewardCatalog };
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Edit the rewards store catalog (cost / duration / enabled per reward).
const catalogSchema = z.object({
  rewards: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(60),
        cost: z.number().optional(),
        durationDays: z.number().optional(),
        enabled: z.boolean().optional(),
      }),
    )
    .max(50),
});
adminRouter.patch(
  '/rewards-catalog',
  validate(catalogSchema),
  asyncHandler(async (req, res) => {
    const data = await setRewardCatalog(req.body.rewards);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const configSchema = z.object({
  contributionPoints: z
    .object({
      referral_accepted: z.number().optional(),
      referral_relevant: z.number().optional(),
      referral_opportunity: z.number().optional(),
      referral_business: z.number().optional(),
    })
    .optional(),
  freeEngagementLimit: z.number().optional(),
});
adminRouter.patch(
  '/config',
  validate(configSchema),
  asyncHandler(async (req, res) => {
    const contributionPoints = req.body.contributionPoints
      ? await setContributionPoints(req.body.contributionPoints)
      : await getContributionPoints();
    const freeEngagementLimit =
      typeof req.body.freeEngagementLimit === 'number'
        ? await setFreeEngagementLimit(req.body.freeEngagementLimit)
        : await getFreeEngagementLimit();
    const data = { contributionPoints, freeEngagementLimit };
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Manually award or reverse a member's Contribution Score points.
const pointsSchema = z.object({
  points: z.number().int(),
  reason: z.string().trim().min(1).max(300),
});
adminRouter.post(
  '/users/:id/points',
  validate(pointsSchema),
  asyncHandler(async (req, res) => {
    await adjustMemberPoints(req.params.id ?? '', req.body.points, req.body.reason);
    const body: ApiResponse<{ ok: true }> = { success: true, data: { ok: true } };
    res.json(body);
  }),
);

// Disputed referrals (recipient marked "not relevant") + admin override.
adminRouter.get(
  '/referrals/disputed',
  asyncHandler(async (_req, res) => {
    const data = await listDisputedReferrals();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const overrideSchema = z.object({
  verdict: z.enum(['relevant', 'opportunity', 'not_relevant']),
});
adminRouter.post(
  '/referrals/:id/override',
  validate(overrideSchema),
  asyncHandler(async (req, res) => {
    const data = await adminOverrideReferral(req.params.id ?? '', req.body.verdict);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const suspendSchema = z.object({ reason: z.string().trim().min(3).max(500) });
adminRouter.post(
  '/users/:id/suspend',
  validate(suspendSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You cannot suspend your own account.');
    }
    const data = await suspendUser(req.user.id, req.params.id ?? '', req.body.reason);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Irreversible: wipe a (non-admin) user and all their data. Test-data cleanup.
adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await hardDeleteUser(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/users/:id/impersonate',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (req.user.id === req.params.id) {
      throw AppError.badRequest('You are already logged in as this user.');
    }
    const data = await impersonateUser(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/listings/pending',
  asyncHandler(async (_req, res) => {
    const data = await listPendingListings();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/listings',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listAllListings(page, limit, q);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/listings/:id/approve',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await approveListing(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(500) });
adminRouter.post(
  '/listings/:id/reject',
  validate(rejectSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await rejectListing(req.user.id, req.params.id ?? '', req.body.reason);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

const featureSchema = z.object({ featured: z.boolean() });
adminRouter.post(
  '/listings/:id/feature',
  validate(featureSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await featureListing(req.user.id, req.params.id ?? '', req.body.featured);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const data = await listAllGroups();
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

adminRouter.post(
  '/groups/:id/archive',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await archiveGroup(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Irreversible: wipe a group with its members, chat and events (test cleanup).
adminRouter.delete(
  '/groups/:id',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await hardDeleteGroup(req.user.id, req.params.id ?? '');
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);
