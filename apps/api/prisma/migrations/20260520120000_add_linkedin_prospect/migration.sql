-- CreateTable: LinkedInProspect (Feature 3 — LinkedIn outreach pipeline)
CREATE TABLE "LinkedInProspect" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "linkedInUrl" TEXT NOT NULL,
    "industry" TEXT,
    "jobRole" TEXT,
    "location" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "fitScore" INTEGER NOT NULL DEFAULT 0,
    "leaderScore" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "assignedGroupId" TEXT,
    "invitedToEventId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "lastTouchedAt" TIMESTAMP(3),
    "convertedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInProspect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkedInProspect_linkedInUrl_key" ON "LinkedInProspect"("linkedInUrl");
CREATE INDEX "LinkedInProspect_status_idx" ON "LinkedInProspect"("status");
CREATE INDEX "LinkedInProspect_fitScore_idx" ON "LinkedInProspect"("fitScore");
CREATE INDEX "LinkedInProspect_assignedGroupId_idx" ON "LinkedInProspect"("assignedGroupId");

ALTER TABLE "LinkedInProspect" ADD CONSTRAINT "LinkedInProspect_assignedGroupId_fkey"
    FOREIGN KEY ("assignedGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LinkedInProspect" ADD CONSTRAINT "LinkedInProspect_convertedUserId_fkey"
    FOREIGN KEY ("convertedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
