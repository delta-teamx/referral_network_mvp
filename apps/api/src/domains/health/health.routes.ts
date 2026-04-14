import { Router } from 'express';
import type { ApiResponse } from '@refnet/shared';

export const healthRouter: Router = Router();

interface HealthPayload {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

/**
 * GET /api/v1/health — liveness probe.
 * No DB/Redis/ES pings here; those belong on a separate /ready route added
 * once those clients are wired (Branch 3+).
 */
healthRouter.get('/', (_req, res) => {
  const body: ApiResponse<HealthPayload> = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
  };
  res.json(body);
});
