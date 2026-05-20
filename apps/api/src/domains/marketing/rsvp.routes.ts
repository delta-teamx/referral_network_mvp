import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { processRsvp } from './linkedin-outreach.service.js';

/**
 * Public RSVP endpoint hit when a LinkedIn prospect clicks the "count me
 * in" link in the meeting-invite email or DM. No auth — the rsvpToken
 * is the credential (random 48 chars, unique per prospect).
 *
 * Successful RSVP flips the prospect's status to "attended" so the
 * pipeline view shows them as confirmed. The frontend renders a static
 * page at /rsvp/[token] that calls this endpoint and shows the result.
 */
export const rsvpRouter: Router = Router();

rsvpRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = req.params.token ?? '';
    const result = await processRsvp(token);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);
