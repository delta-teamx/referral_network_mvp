import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { disconnectPrisma } from './config/prisma.js';
import { healthRouter } from './domains/health/health.routes.js';
import { authRouter } from './domains/core/auth/auth.routes.js';
import { onboardingRouter } from './domains/core/onboarding/onboarding.routes.js';
import { listingsRouter } from './domains/directory/listings/listings.routes.js';
import { categoriesRouter } from './domains/directory/categories/categories.routes.js';
import { connectorRouter } from './domains/matching/connector/connector.routes.js';
import { leadsRouter } from './domains/matching/leads/leads.routes.js';
import { registerLeadSubscribers } from './domains/matching/leads/leads.subscribers.js';
import { dashboardRouter } from './domains/core/dashboard/dashboard.routes.js';
import { reviewsRouter } from './domains/directory/reviews/reviews.routes.js';
import { referralsRouter } from './domains/network/referrals/referrals.routes.js';
import { eventBus } from './domains/core/events/index.js';
import { registerOnboardingSubscribers } from './domains/core/onboarding/onboarding.subscribers.js';
import { seedRbac } from './domains/core/rbac/rbac.seed.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- Domain subscribers ------------------------------------------------------
registerOnboardingSubscribers(eventBus);
registerLeadSubscribers(eventBus);

// ---- Routes -----------------------------------------------------------------
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/onboarding', onboardingRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/connect', connectorRouter);
app.use('/api/v1/consumer-leads', leadsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/reviews', reviewsRouter);
app.use('/api/v1/referrals', referralsRouter);

// 404 + error handler (order matters)
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  // RBAC seeding is idempotent — safe to run on every boot. Failure here
  // shouldn't block startup; log and continue (authz still works against
  // the in-memory ROLE_PERMISSIONS map from @refnet/shared).
  try {
    const result = await seedRbac();
    // eslint-disable-next-line no-console
    console.log(
      `[rbac] seeded ${result.permissions} permissions, added ${result.grants} new grants`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rbac] seed skipped (DB not reachable or migrations not applied):', String(err));
  }

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${env.APP_NAME} listening on http://localhost:${env.PORT}`);
    // eslint-disable-next-line no-console
    console.log(`[api] env=${env.NODE_ENV} frontend=${env.FRONTEND_URL}`);
  });
}

// Graceful shutdown — close DB pool before exit.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
}

void start();
