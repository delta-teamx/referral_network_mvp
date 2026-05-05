-- Referral tracking fields on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralRewardMonths" INTEGER NOT NULL DEFAULT 0;

-- ReferralTracking table
CREATE TABLE IF NOT EXISTS "ReferralTracking" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'direct',
    "eventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "inviteeJoinedAt" TIMESTAMP(3),
    "inviteePaidAt" TIMESTAMP(3),
    "inviteeTier" TEXT,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "rewardMonths" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralTracking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReferralTracking_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id"),
    CONSTRAINT "ReferralTracking_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralTracking_referrerUserId_inviteeEmail_key" ON "ReferralTracking"("referrerUserId", "inviteeEmail");
CREATE INDEX IF NOT EXISTS "ReferralTracking_referrerUserId_idx" ON "ReferralTracking"("referrerUserId");
CREATE INDEX IF NOT EXISTS "ReferralTracking_inviteeEmail_idx" ON "ReferralTracking"("inviteeEmail");
CREATE INDEX IF NOT EXISTS "ReferralTracking_inviteeUserId_idx" ON "ReferralTracking"("inviteeUserId");
