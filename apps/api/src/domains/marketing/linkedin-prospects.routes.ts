import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { prisma } from '../../config/prisma.js';
import {
  PROSPECT_STATUSES,
  advanceProspect,
  getPipelineSnapshot,
  ingestProspect,
} from './linkedin-prospects.service.js';
import { seedSampleProspects, simulateOutreachStep } from './linkedin-simulator.service.js';
import { bulkSendInvites, processRsvp, sendMeetingInvite } from './linkedin-outreach.service.js';

export const linkedinProspectsRouter: Router = Router();
linkedinProspectsRouter.use(authenticate);

function requireAdmin(role: string): void {
  if (role !== 'ADMIN') throw AppError.forbidden();
}

const prospectSchema = z.object({
  fullName: z.string().min(1).max(120),
  headline: z.string().max(280).nullable().optional(),
  linkedInUrl: z.string().url().max(512),
  email: z.string().email().max(254).nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  jobRole: z.string().max(120).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  source: z.string().max(40).optional(),
});

// Single-prospect ingest (Dripify webhook target / manual entry).
linkedinProspectsRouter.post(
  '/',
  validate(prospectSchema),
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const data = await ingestProspect(req.body);
    const body: ApiResponse<typeof data> = { success: true, data };
    res.json(body);
  }),
);

// Bulk ingest (CSV-shaped JSON array).
const bulkSchema = z.object({ prospects: z.array(prospectSchema).max(500) });
linkedinProspectsRouter.post(
  '/bulk',
  validate(bulkSchema),
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const results = [];
    let ingested = 0;
    let errors = 0;
    for (const input of req.body.prospects) {
      try {
        const r = await ingestProspect(input);
        results.push(r);
        ingested++;
      } catch (err) {
        errors++;
        // eslint-disable-next-line no-console
        console.error('[linkedin] ingest failed for', input.linkedInUrl, err);
      }
    }
    const body: ApiResponse<{ ingested: number; errors: number; results: typeof results }> = {
      success: true,
      data: { ingested, errors, results },
    };
    res.json(body);
  }),
);

linkedinProspectsRouter.get(
  '/pipeline',
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const snapshot = await getPipelineSnapshot();
    const body: ApiResponse<typeof snapshot> = { success: true, data: snapshot };
    res.json(body);
  }),
);

linkedinProspectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const mode = req.query.mode === 'leader' ? 'leader' : 'fit';
    const where = status ? { status } : {};
    const rows = await prisma.linkedInProspect.findMany({
      where,
      orderBy: mode === 'leader' ? { leaderScore: 'desc' } : { fitScore: 'desc' },
      take: 100,
      include: {
        assignedGroup: { select: { id: true, name: true, city: true, state: true } },
      },
    });
    const body: ApiResponse<typeof rows> = { success: true, data: rows };
    res.json(body);
  }),
);

const advanceSchema = z.object({
  status: z.enum(PROSPECT_STATUSES),
  notes: z.string().max(1000).optional(),
});
// Demo helpers (admin only) — populate sample prospects and walk the
// pipeline forward when no real Dripify feed is connected.
linkedinProspectsRouter.post(
  '/simulator/seed',
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const result = await seedSampleProspects();
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

linkedinProspectsRouter.post(
  '/simulator/step',
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const result = await simulateOutreachStep();
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

// Send the meeting invite — email primary, Dripify DM fallback. Single prospect.
linkedinProspectsRouter.post(
  '/:id/invite',
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const result = await sendMeetingInvite(req.params.id ?? '');
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

const bulkInviteSchema = z.object({ prospectIds: z.array(z.string().min(8)).min(1).max(50) });
linkedinProspectsRouter.post(
  '/invite/bulk',
  validate(bulkInviteSchema),
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const result = await bulkSendInvites(req.body.prospectIds);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

linkedinProspectsRouter.post(
  '/:id/advance',
  validate(advanceSchema),
  asyncHandler(async (req, res) => {
    requireAdmin(req.user!.role);
    const updated = await advanceProspect(req.params.id ?? '', req.body.status, req.body.notes);
    const body: ApiResponse<typeof updated> = { success: true, data: updated };
    res.json(body);
  }),
);
