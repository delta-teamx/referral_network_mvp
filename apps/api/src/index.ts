import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requireVerified } from './middleware/requireVerified.js';
import { optionalAuthenticate } from './middleware/authenticate.js';
import { disconnectPrisma, prisma } from './config/prisma.js';
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
import { contractsRouter } from './domains/network/contracts/contracts.routes.js';
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
import { referralTrackingRouter } from './domains/network/referral-tracking/referral-tracking.routes.js';
import { registerReferralTrackingSubscribers } from './domains/network/referral-tracking/referral-tracking.subscribers.js';
import { registerGroupSubscribers } from './domains/network/groups/groups.subscribers.js';
import { pipelineRouter } from './domains/network/pipeline/pipeline.routes.js';
import { supportRouter } from './domains/core/support/support.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { mutationRateLimit, rateLimit } from './middleware/rateLimit.js';
import { initSentry, sentryErrorHandler } from './config/sentry.js';

const app = express();

// Respect X-Forwarded-* from a single known proxy (Render/Fly/Netlify edge).
// Needed for accurate IP extraction in rate limiter + Sentry.
app.set('trust proxy', 1);

// Sentry must be first in the middleware chain - it wraps all subsequent
// handlers. No-op when SENTRY_DSN is not configured.
void initSentry(app);

app.use(helmet());

// CORS - allow every origin listed in FRONTEND_URL (comma-separated) plus any
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
      // Netlify preview deploys for OUR site only. The site name is anchored
      // exactly ("--virtualprosnetwork.netlify.app") so an attacker cannot
      // register a site whose name merely starts with our token (e.g.
      // "refnet-evil") and get a credentialed cross-origin allow. Branch part
      // is the only wildcard.
      if (/^https:\/\/[a-z0-9-]+--virtualprosnetwork\.netlify\.app$/i.test(origin)) {
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
registerGroupSubscribers(eventBus);

// One-shot email-preview trigger: when PREVIEW_EMAILS_TO is set, send one of
// every template to that address on boot (branded-redesign review). Remove the
// env var afterwards so it doesn't resend on each restart.
if (env.PREVIEW_EMAILS_TO) {
  const to = env.PREVIEW_EMAILS_TO;
  void import('./domains/core/notifications/email.service.js')
    .then(({ sendTemplatePreviews }) => sendTemplatePreviews(to))
    .then((sent) => {
      // eslint-disable-next-line no-console
      console.log(`[email-preview] sent ${sent.length} template previews to ${to}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[email-preview] failed', err);
    });
}

// ---- Email verification gate ------------------------------------------------
// Write operations on content-creation routes require a verified email.
// Read routes (GET) are unaffected so unverified users can still browse.
const verifiedWriteGate: express.RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  // This gate runs BEFORE each router's own `authenticate`, so req.user is
  // never populated at this point. Checking requireVerified directly here
  // therefore 401'd EVERY write on gated routes (messages, groups, bookings,
  // connections, listings, …) for everyone - which the client interpreted as
  // "logged out", causing the endless bounce to the login page.
  // Parse the token first (optional - routers still enforce auth), then only
  // block writes from a genuinely-unverified account.
  optionalAuthenticate(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user && !req.user.emailVerified) {
      return requireVerified(req, res, next);
    }
    next();
  });
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
app.use('/api/v1/contracts', verifiedWriteGate, contractsRouter);
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
app.use('/api/v1/pipeline', pipelineRouter);
app.use('/api/v1/support', rateLimit({ windowMs: 60_000, max: 30, key: 'support' }), supportRouter);

// 404 + error handler (order matters). Sentry hooks BEFORE our handler so
// it captures the error with full request context before we format JSON.
app.use(notFoundHandler);
app.use(sentryErrorHandler);
app.use(errorHandler);

/**
 * Ensure runtime-added tables exist even when a migration didn't apply (managed
 * DB where `prisma migrate deploy` is skipped/failed). Idempotent + non-fatal -
 * a failure here must never block boot.
 */
async function ensureRuntimeSchema(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "GroupMessage" (
         "id" TEXT NOT NULL,
         "groupId" TEXT NOT NULL,
         "senderId" TEXT NOT NULL,
         "text" TEXT NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
       );`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage" ("groupId", "createdAt");`,
    );
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
    await prisma.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );

    // Columns added to schema.prisma without a matching migration (drift that
    // otherwise 500s the queries that select or default-insert them).
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Availability" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Chicago';`,
    );
    // Messaging tables - the conversation LIST query selects columns the
    // create path never touches (lastReadAt, message fields, timestamps);
    // ensure every one of them exists.
    for (const ddl of [
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
      `ALTER TABLE "ConversationParticipant" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);`,
      // Bookings/events: prod named the meeting-link column "zoomJoinUrl" but
      // the code reads "zoomUrl" - add the expected column and copy links over.
      `ALTER TABLE "BookingCall" ADD COLUMN IF NOT EXISTS "zoomUrl" TEXT;`,
      `DO $$ BEGIN UPDATE "BookingCall" SET "zoomUrl" = "zoomJoinUrl" WHERE "zoomUrl" IS NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;`,
      `ALTER TABLE "NetworkingEvent" ADD COLUMN IF NOT EXISTS "zoomUrl" TEXT;`,
      `DO $$ BEGIN UPDATE "NetworkingEvent" SET "zoomUrl" = "zoomJoinUrl" WHERE "zoomUrl" IS NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;`,
      // Member-to-member referrals have no directory listing.
      `ALTER TABLE "Referral" ALTER COLUMN "listingId" DROP NOT NULL;`,
      // In-platform contracts (created here - no migration needed).
      `CREATE TABLE IF NOT EXISTS "Contract" (
         "id" TEXT NOT NULL,
         "title" TEXT NOT NULL,
         "body" TEXT NOT NULL,
         "senderId" TEXT NOT NULL,
         "receiverId" TEXT NOT NULL,
         "status" TEXT NOT NULL DEFAULT 'sent',
         "senderSignature" TEXT NOT NULL,
         "receiverSignature" TEXT,
         "senderSignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "receiverSignedAt" TIMESTAMP(3),
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
       );`,
      `CREATE INDEX IF NOT EXISTS "Contract_senderId_idx" ON "Contract" ("senderId");`,
      `CREATE INDEX IF NOT EXISTS "Contract_receiverId_idx" ON "Contract" ("receiverId");`,
      `DO $$ BEGIN ALTER TABLE "Contract" ADD CONSTRAINT "Contract_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TABLE "Contract" ADD CONSTRAINT "Contract_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      // DATA HEAL: resolve stale mirror intro suggestions - when one direction
      // of a pair was accepted/declined before the mirror-resolution fix
      // shipped, the opposite row kept resurfacing as a fresh request.
      `DO $$ BEGIN
         UPDATE "Introduction" AS i
         SET "status" = m."status", "acceptedAt" = COALESCE(i."acceptedAt", m."acceptedAt")
         FROM "Introduction" AS m
         WHERE m."senderId" = i."targetId" AND m."targetId" = i."senderId"
           AND m."status" IN ('accepted','declined')
           AND i."status" IN ('suggested','requested');
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // DATA HEAL: accepted intros from before the connection fix get their
      // My-Network connection created retroactively.
      `DO $$ BEGIN
         INSERT INTO "BusinessConnection" ("id","initiatorId","targetId","status","strengthScore","createdAt","acceptedAt","lastInteractAt")
         SELECT gen_random_uuid(), s."senderId", s."targetId", 'accepted', 0, NOW(), NOW(), NOW()
         FROM (
           SELECT DISTINCT ON (LEAST("senderId","targetId"), GREATEST("senderId","targetId"))
                  "senderId", "targetId"
           FROM "Introduction" WHERE "status" = 'accepted'
         ) s
         WHERE NOT EXISTS (
           SELECT 1 FROM "BusinessConnection" c
           WHERE (c."initiatorId" = s."senderId" AND c."targetId" = s."targetId")
              OR (c."initiatorId" = s."targetId" AND c."targetId" = s."senderId")
         );
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // Legacy BookingCall columns the code doesn't write must not block
      // inserts ("A required value is missing" on booking requests).
      `DO $$ BEGIN ALTER TABLE "BookingCall" ALTER COLUMN "durationMin" SET DEFAULT 30; EXCEPTION WHEN undefined_column THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TABLE "BookingCall" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP; EXCEPTION WHEN undefined_column THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TABLE "BookingCall" ALTER COLUMN "zoomJoinUrl" DROP NOT NULL; EXCEPTION WHEN undefined_column THEN NULL; END $$;`,
      `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;`,
      `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "senderId" TEXT;`,
      `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "text" TEXT;`,
      `ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
      // Pipeline board (created here - no migration needed).
      `CREATE TABLE IF NOT EXISTS "PipelineCard" (
         "id" TEXT NOT NULL,
         "ownerId" TEXT NOT NULL,
         "contactUserId" TEXT,
         "consumerLeadId" TEXT,
         "name" TEXT NOT NULL,
         "email" TEXT,
         "source" TEXT NOT NULL DEFAULT 'manual',
         "stage" TEXT NOT NULL DEFAULT 'new',
         "notes" TEXT,
         "stageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "PipelineCard_pkey" PRIMARY KEY ("id")
       );`,
      `CREATE INDEX IF NOT EXISTS "PipelineCard_ownerId_stage_idx" ON "PipelineCard" ("ownerId", "stage");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PipelineCard_ownerId_contactUserId_key" ON "PipelineCard" ("ownerId", "contactUserId");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PipelineCard_ownerId_consumerLeadId_key" ON "PipelineCard" ("ownerId", "consumerLeadId");`,
      `DO $$ BEGIN ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      // Support chat (widget + admin queue).
      `CREATE TABLE IF NOT EXISTS "SupportTicket" (
         "id" TEXT NOT NULL,
         "userId" TEXT,
         "name" TEXT NOT NULL,
         "email" TEXT NOT NULL,
         "topic" TEXT NOT NULL,
         "status" TEXT NOT NULL DEFAULT 'open',
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
       );`,
      `CREATE INDEX IF NOT EXISTS "SupportTicket_status_updatedAt_idx" ON "SupportTicket" ("status", "updatedAt" DESC);`,
      `CREATE TABLE IF NOT EXISTS "SupportMessage" (
         "id" TEXT NOT NULL,
         "ticketId" TEXT NOT NULL,
         "senderType" TEXT NOT NULL,
         "body" TEXT NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
       );`,
      `CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage" ("ticketId", "createdAt");`,
      `DO $$ BEGIN ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      // Post-call peer ratings (no listing required) - feed the analytics
      // rating card for members without a directory listing.
      `ALTER TABLE "BookingCall" ADD COLUMN IF NOT EXISTS "hostRating" INTEGER;`,
      `ALTER TABLE "BookingCall" ADD COLUMN IF NOT EXISTS "guestRating" INTEGER;`,
      // Verification-code step removed: activate any account still waiting.
      `UPDATE "User" SET "emailVerified" = true WHERE "emailVerified" = false;`,
      // Members can link their LinkedIn profile.
      `ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;`,
      // Members can show their business website.
      `ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "website" TEXT;`,
      // Default availability timezone moved to Eastern.
      `ALTER TABLE "Availability" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York';`,
      // Indexes on soft-delete columns filtered on every hot query path.
      `CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User" ("deletedAt");`,
      `CREATE INDEX IF NOT EXISTS "Listing_deletedAt_idx" ON "Listing" ("deletedAt");`,
      // Prevent double-booking at the DB level: no two pending/confirmed calls
      // for the same host may overlap in time (closes the check-then-insert race).
      `CREATE EXTENSION IF NOT EXISTS btree_gist;`,
      `DO $$ BEGIN
         ALTER TABLE "BookingCall" ADD CONSTRAINT "BookingCall_no_overlap"
           EXCLUDE USING gist ("hostId" WITH =, tsrange("startsAt", "endsAt") WITH &&)
           WHERE ("status" IN ('pending','confirmed'));
       EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; WHEN others THEN NULL; END $$;`,
      // Short, shareable invite codes for referralnova.com/join/<code> links.
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User" ("referralCode");`,
      // Refresh-token revocation: bump this to invalidate all outstanding
      // refresh tokens for a user (password reset / log out everywhere).
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;`,
      // MEDIA HEAL: profile photos/videos stored as direct S3 URLs (the old
      // browser-to-S3 flow) or minted against a wrong API base render as
      // broken images. Rewrite them to the canonical download proxy.
      `DO $$ BEGIN
         UPDATE "MemberProfile"
         SET "photoUrl" = 'https://api.referralnova.com/api/v1/messages/attachments/file?key=' || split_part("photoUrl", '.amazonaws.com/', 2)
         WHERE "photoUrl" LIKE '%.amazonaws.com/headshots/%';
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      `DO $$ BEGIN
         UPDATE "MemberProfile"
         SET "videoUrl" = 'https://api.referralnova.com/api/v1/messages/attachments/file?key=' || split_part("videoUrl", '.amazonaws.com/', 2)
         WHERE "videoUrl" LIKE '%.amazonaws.com/videos/%';
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      `DO $$ BEGIN
         UPDATE "MemberProfile"
         SET "photoUrl" = 'https://api.referralnova.com/api/v1/' || split_part("photoUrl", '/api/v1/', 2)
         WHERE "photoUrl" LIKE '%/api/v1/messages/attachments/file?key=headshots%'
           AND "photoUrl" NOT LIKE 'https://api.referralnova.com/%'
           AND "photoUrl" NOT LIKE 'http://localhost%';
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      `DO $$ BEGIN
         UPDATE "MemberProfile"
         SET "videoUrl" = 'https://api.referralnova.com/api/v1/' || split_part("videoUrl", '/api/v1/', 2)
         WHERE "videoUrl" LIKE '%/api/v1/messages/attachments/file?key=videos%'
           AND "videoUrl" NOT LIKE 'https://api.referralnova.com/%'
           AND "videoUrl" NOT LIKE 'http://localhost%';
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // Admins are operators, not members: purge AI-suggested intros that
      // involve an admin account so they vanish from member feeds.
      `DO $$ BEGIN
         DELETE FROM "Introduction" i
         USING "User" u
         WHERE i."status" = 'suggested'
           AND (i."senderId" = u.id OR i."targetId" = u.id)
           AND u."role" = 'ADMIN';
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // FOUNDING GRANT: Brian Parnell's account is comped lifetime Premium.
      `DO $$ BEGIN UPDATE "User" SET "subscriptionTier"='PREMIUM' WHERE "email"='brian@virtualpros.com' AND "subscriptionTier" <> 'PREMIUM'; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // FOUNDING HEAL for Google sign-ups: the OAuth path used to force every
      // Google account to FREE, so real members who joined with Google (e.g.
      // Lisa Murphy) showed as free. Retroactively grant the founding tier to
      // those accounts (passwordHash IS NULL = social sign-in), but only while
      // the community is still within the 200 founding spots. Idempotent.
      `DO $$
       DECLARE genuine int;
       BEGIN
         SELECT count(*) INTO genuine FROM "User"
           WHERE "deletedAt" IS NULL AND "role" <> 'ADMIN'
             AND "email" NOT LIKE '%@vpn-demo.com';
         IF genuine <= 200 THEN
           UPDATE "User" SET "subscriptionTier"='PREMIUM'
             WHERE "subscriptionTier"='FREE'
               AND "passwordHash" IS NULL
               AND "role" <> 'ADMIN'
               AND "deletedAt" IS NULL
               AND "email" NOT LIKE '%@vpn-demo.com';
         END IF;
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // ADMIN EMAIL CHANGE: Igor's admin account moved to a new address. Rename
      // the existing row (keeps his password + admin role) so he can log in and
      // receive new-signup notifications; if the new email already exists,
      // just ensure it's an admin. Idempotent - no-op after the first boot.
      `DO $$ BEGIN UPDATE "User" SET "email"='beanieland2021@gmail.com', "role"='ADMIN' WHERE "email"='igor@virtualpro.com'; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      `DO $$ BEGIN UPDATE "User" SET "role"='ADMIN' WHERE "email"='beanieland2021@gmail.com' AND "role" <> 'ADMIN'; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // STAGE MERGE: contract_signed and won are one stage now.
      `DO $$ BEGIN UPDATE "PipelineCard" SET "stage"='won' WHERE "stage"='contract_signed'; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      // INTERCONNECTION HEAL: intro requests between people who already met
      // on Zoom, signed a contract, or are connected must not keep showing
      // as "waiting for response".
      `DO $$ BEGIN
         UPDATE "Introduction" i SET "status"='accepted', "acceptedAt"=COALESCE(i."acceptedAt", NOW())
         WHERE i."status" IN ('suggested','requested') AND (
           EXISTS (SELECT 1 FROM "BookingCall" b WHERE b."status" IN ('confirmed','completed')
                   AND ((b."hostId"=i."senderId" AND b."guestId"=i."targetId")
                     OR (b."hostId"=i."targetId" AND b."guestId"=i."senderId")))
           OR EXISTS (SELECT 1 FROM "Contract" c
                   WHERE (c."senderId"=i."senderId" AND c."receiverId"=i."targetId")
                      OR (c."senderId"=i."targetId" AND c."receiverId"=i."senderId"))
           OR EXISTS (SELECT 1 FROM "BusinessConnection" bc WHERE bc."status"='accepted'
                   AND ((bc."initiatorId"=i."senderId" AND bc."targetId"=i."targetId")
                     OR (bc."initiatorId"=i."targetId" AND bc."targetId"=i."senderId")))
         );
       EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
    ]) {
      await prisma.$executeRawUnsafe(ddl);
    }
    // Group white-label fields - prod was missing some, which 500'd group
    // creation (Prisma includes defaulted columns in the INSERT) and the
    // group-detail include (selects every column).
    for (const ddl of [
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "billingModel" TEXT NOT NULL DEFAULT 'platform';`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "seatPriceCents" INTEGER;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "groupPriceCents" INTEGER;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;`,
      `ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;`,
      // Priority Support: admin-initiated ROUL outreach threads.
      `ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "priority" BOOLEAN NOT NULL DEFAULT false;`,
      // ROUL Support conversations surfaced in the member's Messages tab.
      `ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isOfficial" BOOLEAN NOT NULL DEFAULT false;`,
      // Contribution Score: referral quality verification + the points ledger.
      `ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "relevance" TEXT;`,
      `ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "relevanceAt" TIMESTAMP(3);`,
      `CREATE TABLE IF NOT EXISTS "ContributionEvent" (
         "id" TEXT PRIMARY KEY,
         "userId" TEXT NOT NULL,
         "type" TEXT NOT NULL,
         "points" INTEGER NOT NULL,
         "occurredAt" TIMESTAMP(3) NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
       );`,
      `CREATE INDEX IF NOT EXISTS "ContributionEvent_userId_idx" ON "ContributionEvent" ("userId");`,
      `CREATE INDEX IF NOT EXISTS "ContributionEvent_occurredAt_idx" ON "ContributionEvent" ("occurredAt");`,
      // Admin-editable settings store (Rewards & Points config).
      `CREATE TABLE IF NOT EXISTS "AppSetting" (
         "key" TEXT PRIMARY KEY,
         "value" JSONB NOT NULL,
         "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
       );`,
    ]) {
      await prisma.$executeRawUnsafe(ddl);
    }
    // eslint-disable-next-line no-console
    console.log('[schema] ensured GroupMessage table + drifted columns');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[schema] ensureRuntimeSchema failed (non-fatal):', String(err));
  }
}

async function start(): Promise<void> {
  await ensureRuntimeSchema();
  // RBAC seeding is idempotent - safe to run on every boot. Failure here
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

  // Background jobs - BullMQ when REDIS_URL is real, setInterval otherwise.
  void startScheduler();
  startMatchmakingScheduler();

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${env.APP_NAME} listening on http://localhost:${env.PORT}`);
    // eslint-disable-next-line no-console
    console.log(`[api] env=${env.NODE_ENV} frontend=${env.FRONTEND_URL}`);
  });
}

// Graceful shutdown - close DB pool before exit.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
}

void start();
