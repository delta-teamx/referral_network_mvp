-- Feature 3: meeting-invite flow fields on LinkedInProspect.
ALTER TABLE "LinkedInProspect"
    ADD COLUMN "email" TEXT,
    ADD COLUMN "invitedAt" TIMESTAMP(3),
    ADD COLUMN "invitedChannel" TEXT,
    ADD COLUMN "rsvpToken" TEXT,
    ADD COLUMN "rsvpedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "LinkedInProspect_rsvpToken_key" ON "LinkedInProspect"("rsvpToken");
CREATE INDEX "LinkedInProspect_email_idx" ON "LinkedInProspect"("email");
