import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, EventType } from '@refnet/shared';
import { EVENT_TYPES, zipCodeSchema } from '@refnet/shared';
import { validate } from '../../../middleware/validate.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { match, type MatchedListing } from './connector.service.js';

export const connectorRouter: Router = Router();

const matchSchema = z.object({
  eventType: z.enum(EVENT_TYPES as readonly [EventType, ...EventType[]]),
  zip: zipCodeSchema,
  limit: z.coerce.number().int().min(3).max(20).optional(),
});

connectorRouter.post(
  '/match',
  validate(matchSchema),
  asyncHandler(async (req, res) => {
    const results = await match(req.body);
    const body: ApiResponse<MatchedListing[]> = { success: true, data: results };
    res.json(body);
  }),
);

connectorRouter.get(
  '/match',
  asyncHandler(async (req, res) => {
    const parsed = matchSchema.parse({
      eventType: req.query.eventType,
      zip: req.query.zip,
      limit: req.query.limit,
    });
    const results = await match(parsed);
    const body: ApiResponse<MatchedListing[]> = { success: true, data: results };
    res.json(body);
  }),
);
