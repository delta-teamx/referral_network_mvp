import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requireVerified } from './middleware/requireVerified.js';
import { disconnectPrisma } from './config/prisma.js';
import { healthRouter } from './domains/health/health.routes.js';
import { authRouter } from './domains/core/auth/auth.routes.js';
import { onboardingRouter } from './domains/core/onboarding/onboarding.routes.js';
import { listingsRouter } from './domains/directory/listings/listings.routes.js';
import { photosRouter } from './domains/directory/photos/photos.routes.js';
import { categoriesRouter } from './domains/directory/categories/categories.routes.js';
import { connectorRouter } from './domains/matching/connector/connector.routes.js';
import { leadsRouter } from './domains/matching/leads/leads.routes.js';
import { registerLeadSubscribers } from './domains/matching/leads/leads.subscribers.js';
import { dashboardRouter } from './domains/core/dashboard/dashboard.routes.js';
import { reviewsRouter } from './domains/directory/reviews/reviews.routes.js';
import { referralsRouter } from './domains/network/referrals/referrals.routes.js';
import { connectionsRouter } from './domains/network/connections/connections.routes.js';
import { invitationsRouter } from './domains/network/invitations/invitations.routes.js';
import { groupsRouter } from './domains/network/groups/groups.routes.js';
import { profilesRouter } from './domains/network/profiles/profiles.routes.js';
import { aiRouter } from './domains/matching/ai/ai.routes.js';
import { billingRouter } from './domains/billing/billing.routes.js';
import { stripeWebhookHandler } from './domains/billing/billing.webhook.js';
import { adminRouter } from './domains/admin/admin.routes.js';
import { notificationsRouter } from './domains/core/notifications/notifications.routes.js';
import { messagingRouter } from './domains/network/messaging/messaging.routes.js';
import { bookingsRouter } from './domains/network/bookings/bookings.routes.js';
import { eventsRouter } from './domains/network/events/events.routes.js';
import { eventBus } from './domains/core/events/index.js';
import { registerOnboardingSubscribers } from './domains/core/onboarding/onboarding.subscribers.js';
import { registerNotificationSubscribers } from './domains/core/notifications/notifications.subscribers.js';
import { registerTrustSubscribers } from './domains/core/trust/trust.subscribers.js';
import { startScheduler } from './domains/core/jobs/scheduler.js';
import { seedRbac } from './domains/core/rbac/rbac.seed.js';
import { podsRouter } from './domains/matching/pods/pods.routes.js';
import { startMatchmakingScheduler } from './domains/matching/pods/pods.scheduler.js';
import { startMatchesScheduler } from './domains/matching/ai/matches.scheduler.js';
import { referralTrackingRouter } from './domains/network/referral-tracking/referral-tracking.routes.js';
import { registerReferralTrackingSubscribers } from './domains/network/referral-tracking/referral-tracking.subscribers.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { mutationRateLimit, rateLimit } from './middleware/rateLimit.js';
import { initSentry, sentryErrorHandler } from './config/sentry.js';

const app = express();

// Respect X-Forwarded-* from a single known proxy (Render/Fly/Netlify edge).
// Needed for accurate IP extraction in rate limiter + Sentry.
app.set('trust proxy', 1);

// Sentry must be first in the middleware chain — it wraps all subsequent
// handlers. No-op when SENTRY_DSN is not configured.
void initSentry(app);

app.use(helmet());

// CORS — allow every origin listed in FRONTEND_URL (comma-separated) plus any
// *.netlify.app preview domain. Keeps localhost dev working and lets us add
// staging/prod domains without code changes.
const allowedOrigins = env.FRONTEND_URL.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (/^https:\/\/[a-z0-9-]+--(refnet|referral-network|nrg)[a-z0-9-]*\.netlify\.app$/i.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }),
);
// Stripe webhook needs the raw request body to verify the signature, so it
// must be mounted BEFORE express.json() strips / parses it.
app.post(
  '/api/v1/billing/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global soft limit on mutating requests. Fine-grained limits live on
// specific routes (auth, signup) for tighter policies.
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return mutationRateLimit(req, res, next);
});

// ---- Domain subscribers ------------------------------------------------------
registerOnboardingSubscribers(eventBus);
registerLeadSubscribers(eventBus);
registerNotificationSubscribers(eventBus);
registerTrustSubscribers(eventBus);
registerReferralTrackingSubscribers(eventBus);

// ---- Email verification gate ------------------------------------------------
// Write operations on content-creation routes require a verified email.
// Read routes (GET) are unaffected so unverified users can still browse.
const verifiedWriteGate: express.RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return requireVerified(req, res, next);
  }
  next();
};

// ---- Routes -----------------------------------------------------------------
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/onboarding', onboardingRouter);
app.use('/api/v1/listings', verifiedWriteGate, listingsRouter);
app.use('/api/v1/photos', verifiedWriteGate, photosRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/connect', connectorRouter);
app.use('/api/v1/consumer-leads', leadsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/reviews', verifiedWriteGate, reviewsRouter);
app.use('/api/v1/referrals', verifiedWriteGate, referralsRouter);
app.use('/api/v1/connections', verifiedWriteGate, connectionsRouter);
app.use('/api/v1/invitations', verifiedWriteGate, invitationsRouter);
app.use('/api/v1/groups', verifiedWriteGate, groupsRouter);
app.use('/api/v1/profiles', profilesRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/v1/admin', rateLimit({ windowMs: 60_000, max: 30, key: 'admin' }), adminRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/messages', verifiedWriteGate, messagingRouter);
app.use('/api/v1/bookings', verifiedWriteGate, bookingsRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/pods', podsRouter);
app.use('/api/v1/referral-tracking', referralTrackingRouter);

// 404 + error handler (order matters). Sentry hooks BEFORE our handler so
// it captures the error with full request context before we format JSON.
app.use(notFoundHandler);
app.use(sentryErrorHandler);
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

  // Background jobs — BullMQ when REDIS_URL is real, setInterval otherwise.
  void startScheduler();
  startMatchmakingScheduler();
  startMatchesScheduler();

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
