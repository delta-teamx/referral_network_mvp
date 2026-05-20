import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@refnet/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { eventBus } from '../core/events/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Feature 4 brief: 'Membership form integration — connect with NRG.online so
 * signups flow directly into the platform without manual data entry.'
 *
 * NRG.online POSTs a signed JSON payload here on every successful membership
 * form submission. We verify the HMAC, create or upsert the User row,
 * mark their email as externally verified (the form already collected it),
 * and publish user.signed_up so the welcome-packet + onboarding pipelines
 * fire just like a direct signup.
 *
 * Idempotent: same externalId or email returns the existing user row
 * unchanged. Signature verification is required in production but skipped
 * when NRG_ONLINE_WEBHOOK_SECRET is unset (dev only).
 */

export const nrgOnlineRouter: Router = Router();

const payloadSchema = z.object({
  externalId: z.string().min(1).max(64),
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).nullable().optional(),
  source: z.string().max(60).optional(),
  fundingTier: z.enum(['FREE', 'PRO', 'PREMIUM']).optional(),
});

nrgOnlineRouter.post(
  '/nrg-online',
  asyncHandler(async (req, res) => {
    verifySignature(req);
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest('Invalid NRG.online payload');
    }
    const payload = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase().trim() },
      select: { id: true, role: true },
    });

    if (existing) {
      const body: ApiResponse<{ userId: string; created: false }> = {
        success: true,
        data: { userId: existing.id, created: false },
      };
      res.json(body);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase().trim(),
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone ?? null,
        emailVerified: true,
        role: 'BUSINESS_OWNER',
        subscriptionTier: payload.fundingTier ?? 'FREE',
        passwordHash: '',
      },
      select: { id: true, email: true, role: true },
    });

    await eventBus.publish('user.signed_up', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const body: ApiResponse<{ userId: string; created: true }> = {
      success: true,
      data: { userId: user.id, created: true },
    };
    res.json(body);
  }),
);

function verifySignature(req: Request): void {
  const secret = env.NRG_ONLINE_WEBHOOK_SECRET;
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      throw AppError.unauthorized('NRG_ONLINE_WEBHOOK_SECRET not configured');
    }
    return; // dev / test
  }
  const signature = req.header('x-signature');
  if (!signature) throw AppError.unauthorized('Missing X-Signature');

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
