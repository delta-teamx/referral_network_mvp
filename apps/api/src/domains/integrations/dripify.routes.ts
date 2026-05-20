import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { ingestProspect } from '../marketing/linkedin-prospects.service.js';

/**
 * Dripify webhook receiver (Feature 3). Dripify POSTs each newly connected
 * LinkedIn prospect to /api/v1/integrations/dripify. We translate its
 * payload shape into our ProspectInput and run it through the existing
 * scoring + routing pipeline.
 *
 * Dripify's webhook signs the body with HMAC-SHA256 using the secret
 * configured in their dashboard (mirror it in DRIPIFY_WEBHOOK_SECRET).
 * In dev (no secret), signature verification is skipped.
 *
 * The payload schema below is the documented Dripify "lead added" event
 * shape (slightly normalized). Once real creds land, this endpoint just
 * works — no code changes required.
 */

export const dripifyRouter: Router = Router();

const payloadSchema = z.object({
  event: z.literal('lead.connected').or(z.literal('lead.added')),
  data: z.object({
    fullName: z.string().min(1).max(120),
    headline: z.string().max(280).optional(),
    profileUrl: z.string().url().max(512),
    email: z.string().email().max(254).optional(),
    industry: z.string().max(120).optional(),
    occupation: z.string().max(120).optional(),
    location: z.string().max(120).optional(),
    city: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    country: z.string().max(80).optional(),
  }),
});

dripifyRouter.post(
  '/dripify',
  asyncHandler(async (req, res) => {
    verifySignature(req);
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest('Invalid Dripify payload');

    const { data } = parsed.data;
    const result = await ingestProspect({
      fullName: data.fullName,
      headline: data.headline ?? null,
      linkedInUrl: data.profileUrl,
      email: data.email ?? null,
      industry: data.industry ?? null,
      jobRole: data.occupation ?? null,
      location: data.location ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      country: data.country ?? null,
      source: 'dripify',
    });

    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.json(body);
  }),
);

function verifySignature(req: Request): void {
  const secret = process.env.DRIPIFY_WEBHOOK_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw AppError.unauthorized('DRIPIFY_WEBHOOK_SECRET not configured');
    }
    return;
  }
  const signature = req.header('x-dripify-signature');
  if (!signature) throw AppError.unauthorized('Missing X-Dripify-Signature');
  const rawBody = typeof (req as Request & { rawBody?: string }).rawBody === 'string'
    ? (req as Request & { rawBody?: string }).rawBody!
    : JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const provided = Buffer.from(signature.replace(/^sha256=/, ''), 'utf8');
  if (
    expectedBuf.length !== provided.length ||
    !crypto.timingSafeEqual(expectedBuf, provided)
  ) {
    throw AppError.unauthorized('Bad signature');
  }
}
