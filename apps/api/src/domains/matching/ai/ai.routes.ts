import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../../middleware/authenticate.js';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../utils/AppError.js';
import { generateMatchesForUser, refreshSuggestionsForUser } from './ai-matching.service.js';
import { generateTieredMatchesForUser } from './tiered-matches.service.js';
import { refineSuggestionsForUser } from './llm-refinement.service.js';
import { isLlmEnabled } from './llm-scorer.service.js';
import { runDailyMatchesRefresh } from './matches.scheduler.js';
import { getMemberProfileForViewing } from './profile.service.js';
import { getMemberAnalytics } from './analytics.service.js';
import {
  ONBOARDING_MONTH_COUNT,
  ONBOARDING_TARGET_PER_MONTH,
  assignOnboardingReferrals,
} from './onboarding-referrals.service.js';
import { listOnboardingMembers } from './onboarding-admin.service.js';
import { computeEngagement, listEngagementForAllMembers } from './engagement.service.js';
import { runReengagementCampaign } from './reengagement.service.js';
import { getMatchingStats, getWeights } from './ai-learning.service.js';
import {
  completeIntro,
  listCompletedIntros,
  listSuggestionsForUser,
  requestIntro,
  requestIntroByTarget,
  respondToIntro,
} from './introductions.service.js';

export const aiRouter: Router = Router();
aiRouter.use(authenticate);

// On-demand "who should I meet?" — returns transient suggestions (not persisted)
aiRouter.get(
  '/matches',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    const matches = await generateMatchesForUser(req.user.id, { groupId, limit: 10 });
    const body: ApiResponse<typeof matches> = { success: true, data: matches };
    res.json(body);
  }),
);

// Per-member networking analytics (intros, meetings, connections by month).
aiRouter.get(
  '/analytics/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const months =
      typeof req.query.months === 'string' ? Math.max(1, Math.min(24, Number(req.query.months))) : 6;
    const analytics = await getMemberAnalytics(req.user.id, { months });
    const body: ApiResponse<typeof analytics> = { success: true, data: analytics };
    res.json(body);
  }),
);

// Member profile view — drives the "view profile" page off a match card.
aiRouter.get(
  '/profile/:userId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const profile = await getMemberProfileForViewing(req.user.id, req.params.userId ?? '');
    const body: ApiResponse<typeof profile> = { success: true, data: profile };
    res.json(body);
  }),
);

// Tiered match view (Level 1 / Level 2 / Level 3) — powers the member dashboard
aiRouter.get(
  '/matches/tiered',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    const buckets = await generateTieredMatchesForUser(req.user.id, { groupId, limit: 60 });
    const body: ApiResponse<typeof buckets> = { success: true, data: buckets };
    res.json(body);
  }),
);

// Trigger suggestion refresh (creates Introduction rows)
aiRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const created = await refreshSuggestionsForUser(req.user.id);
    const body: ApiResponse<{ created: number }> = { success: true, data: { created } };
    res.json(body);
  }),
);

// LLM refinement — upgrades the user's persisted Introduction suggestions with
// Claude-derived scores and narrative reasons. Returns 503 when ANTHROPIC_API_KEY
// is unset so callers can fall back gracefully.
aiRouter.post(
  '/refine',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    if (!isLlmEnabled()) {
      throw new AppError('LLM scoring is not configured', 503, 'AI_LLM_DISABLED');
    }
    const limit =
      typeof req.query.limit === 'string' ? Math.max(1, Math.min(50, Number(req.query.limit))) : 30;
    const result = await refineSuggestionsForUser(req.user.id, { limit });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// My suggestion feed (persisted Introduction rows)
aiRouter.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const suggestions = await listSuggestionsForUser(req.user.id);
    const body: ApiResponse<typeof suggestions> = { success: true, data: suggestions };
    res.json(body);
  }),
);

// History of completed/declined intros
aiRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const intros = await listCompletedIntros(req.user.id);
    const body: ApiResponse<typeof intros> = { success: true, data: intros };
    res.json(body);
  }),
);

// Request an intro by target user id (creates Introduction on the fly or upgrades suggested → requested)
aiRouter.post(
  '/intros/by-target/:targetUserId/request',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const intro = await requestIntroByTarget(req.user.id, req.params.targetUserId ?? '');
    const body: ApiResponse<typeof intro> = { success: true, data: intro };
    res.json(body);
  }),
);

// Request an intro (changes status: suggested → requested)
aiRouter.post(
  '/introductions/:id/request',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const intro = await requestIntro(req.params.id ?? '', req.user.id);
    const body: ApiResponse<typeof intro> = { success: true, data: intro };
    res.json(body);
  }),
);

// Respond to an intro request (accept / decline)
const respondSchema = z.object({ action: z.enum(['accept', 'decline']) });
aiRouter.post(
  '/introductions/:id/respond',
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const intro = await respondToIntro(req.params.id ?? '', req.user.id, req.body.action);
    const body: ApiResponse<typeof intro> = { success: true, data: intro };
    res.json(body);
  }),
);

// Complete an intro (record outcome)
const completeSchema = z.object({
  outcome: z.enum(['met', 'referred', 'deal_closed', 'no_fit']),
  dealValue: z.number().positive().optional(),
  notes: z.string().trim().max(500).optional(),
});
aiRouter.post(
  '/introductions/:id/complete',
  validate(completeSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const intro = await completeIntro(req.params.id ?? '', req.user.id, req.body);
    const body: ApiResponse<typeof intro> = { success: true, data: intro };
    res.json(body);
  }),
);

// Admin: list members currently in their first 3 months with their
// per-month onboarding-referral counts. Drives the override panel.
aiRouter.get(
  '/admin/onboarding-members',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const rows = await listOnboardingMembers();
    const body: ApiResponse<typeof rows> = { success: true, data: rows };
    res.json(body);
  }),
);

// Admin: manually trigger an onboarding referral assignment for a specific
// member and month. Used by the admin override panel (Feature 2 brief).
// `count` defaults to ONBOARDING_TARGET_PER_MONTH (10); pass a smaller value
// to top-up a partial month.
const assignOnboardingSchema = z.object({
  month: z.number().int().min(1).max(ONBOARDING_MONTH_COUNT),
  count: z.number().int().min(1).max(ONBOARDING_TARGET_PER_MONTH).optional(),
});
aiRouter.post(
  '/admin/members/:userId/onboarding-referrals',
  validate(assignOnboardingSchema),
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const result = await assignOnboardingReferrals(req.params.userId ?? '', {
      month: req.body.month,
      count: req.body.count,
      batch: 'admin',
    });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Admin: manually trigger the daily matches refresh (used for ops before the
// scheduler has fired, or to backfill after a deploy). Idempotent.
aiRouter.post(
  '/admin/run-daily',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const stats = await runDailyMatchesRefresh();
    const body: ApiResponse<typeof stats> = { success: true, data: stats };
    res.json(body);
  }),
);

// Member's own engagement score (Feature 6: ROI dashboard input).
aiRouter.get(
  '/engagement/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await computeEngagement(req.user.id);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Admin: list every member's engagement score. Feeds the re-engagement
// preview panel.
aiRouter.get(
  '/admin/engagement',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const rows = await listEngagementForAllMembers();
    const body: ApiResponse<typeof rows> = { success: true, data: rows };
    res.json(body);
  }),
);

// Admin: run the bulk re-engagement campaign. ?dryRun=1 returns the
// would-be recipients without sending.
aiRouter.post(
  '/admin/reengagement',
  asyncHandler(async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') throw AppError.forbidden();
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const result = await runReengagementCampaign({ dryRun });
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// AI system stats + weights (admin/leader view)
aiRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    if (!req.user) throw AppError.unauthorized();
    const [stats, weights] = await Promise.all([getMatchingStats(), getWeights()]);
    const body: ApiResponse<{ stats: typeof stats; weights: typeof weights }> = {
      success: true,
      data: { stats, weights },
    };
    res.json(body);
  }),
);
