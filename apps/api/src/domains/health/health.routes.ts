import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';

export const healthRouter: Router = Router();

interface HealthPayload {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  /** Git commit of the running build (Render sets RENDER_GIT_COMMIT). */
  commit: string;
  startedAt: string;
}

const STARTED_AT = new Date().toISOString();
const COMMIT = (process.env.RENDER_GIT_COMMIT ?? 'unknown').slice(0, 7);

/**
 * GET /api/v1/health — liveness probe.
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
      startedAt: STARTED_AT,
    },
  };
  res.json(body);
});
