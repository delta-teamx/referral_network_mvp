import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';
import { env } from '../../config/env.js';

export const healthRouter: Router = Router();

interface HealthPayload {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  /** Git commit of the running build (Render sets RENDER_GIT_COMMIT). */
  commit: string;
  /** Bump per feature drop so you can confirm the API build without a SHA. */
  build: string;
  startedAt: string;
  /** Which new capabilities this running build actually has. */
  capabilities: Record<string, boolean | string>;
}

const STARTED_AT = new Date().toISOString();
const COMMIT = (process.env.RENDER_GIT_COMMIT ?? 'unknown').slice(0, 7);
// Human-readable build label - bump on each feature drop.
const BUILD = 'roul+emails+media+photofix-2026-07-30';

/**
 * GET /api/v1/health - liveness probe.
 * Includes the deployed commit so anyone can verify which build is live
 * (no more guessing whether a fix actually reached production).
 * No DB/Redis/ES pings here; those belong on a separate /ready route.
 */
healthRouter.get('/', (_req, res) => {
  const body: ApiResponse<HealthPayload> = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      commit: COMMIT,
      build: BUILD,
      startedAt: STARTED_AT,
      capabilities: {
        roulConfigured: Boolean(env.OPENAI_API_KEY),
        roulModel: env.OPENAI_MODEL,
        emailProvider: env.RESEND_API_KEY ? 'resend' : env.SENDGRID_API_KEY ? 'sendgrid' : 'console',
        mediaRedirect: true,
        supportEscalationEmail: env.SUPPORT_ESCALATION_EMAIL,
      },
    },
  };
  res.json(body);
});
