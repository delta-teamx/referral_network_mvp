import { prisma } from '../../config/prisma.js';

/**
 * Lead-gen funnel tracking (Feature 5). We persist views and CTA clicks
 * directly into the DomainEvent table (append-only audit log) so we can
 * compute conversion rates with a single SQL query and don't need a new
 * Prisma model just for analytics.
 *
 * Events:
 *   - funnel.viewed: when the preview page mounts
 *   - funnel.cta_clicked: when a CTA button is clicked (cta = "join", "share")
 *   - funnel.signup_attributed: linked to a signup that includes ?ref=<sessionId>
 */

export interface FunnelStats {
  views: number;
  ctaClicks: number;
  signupsAttributed: number;
  ctaClickRate: number;
  signupRate: number;
}

export async function logFunnelView(payload: {
  sessionId: string;
  referrer: string | null;
  campaign: string | null;
}): Promise<void> {
  await prisma.domainEvent.create({
    data: {
      type: 'funnel.viewed',
      aggregateId: payload.sessionId,
      payload: payload as unknown as object,
    },
  });
}

export async function logFunnelCta(payload: { sessionId: string; cta: string }): Promise<void> {
  await prisma.domainEvent.create({
    data: {
      type: 'funnel.cta_clicked',
      aggregateId: payload.sessionId,
      payload: payload as unknown as object,
    },
  });
}

export async function getFunnelStats(opts: { since?: Date } = {}): Promise<FunnelStats> {
  const where = opts.since ? { publishedAt: { gte: opts.since } } : {};
  const [views, ctaClicks, signupsAttributed] = await Promise.all([
    prisma.domainEvent.count({ where: { ...where, type: 'funnel.viewed' } }),
    prisma.domainEvent.count({ where: { ...where, type: 'funnel.cta_clicked' } }),
    prisma.domainEvent.count({ where: { ...where, type: 'funnel.signup_attributed' } }),
  ]);
  return {
    views,
    ctaClicks,
    signupsAttributed,
    ctaClickRate: views > 0 ? Math.round((ctaClicks / views) * 100) : 0,
    signupRate: views > 0 ? Math.round((signupsAttributed / views) * 100) : 0,
  };
}
