-- Add service area fields to MemberProfile
ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "serviceArea" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "serviceRadius" INTEGER;

-- MatchmakingPod
CREATE TABLE IF NOT EXISTS "MatchmakingPod" (
    "id" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "zoomMeetingId" TEXT,
    "zoomJoinUrl" TEXT,
    "zoomStartUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "podSize" INTEGER NOT NULL DEFAULT 0,
    "matchCriteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "MatchmakingPod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MatchmakingPod_scheduledAt_idx" ON "MatchmakingPod"("scheduledAt");
CREATE INDEX IF NOT EXISTS "MatchmakingPod_status_idx" ON "MatchmakingPod"("status");

-- PodMember
CREATE TABLE IF NOT EXISTS "PodMember" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invited" BOOLEAN NOT NULL DEFAULT true,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PodMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PodMember_podId_fkey" FOREIGN KEY ("podId") REFERENCES "MatchmakingPod"("id") ON DELETE CASCADE,
    CONSTRAINT "PodMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PodMember_podId_userId_key" ON "PodMember"("podId", "userId");
CREATE INDEX IF NOT EXISTS "PodMember_userId_idx" ON "PodMember"("userId");

-- MeetingHistory
CREATE TABLE IF NOT EXISTS "MeetingHistory" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "metAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingHistory_userAId_userBId_key" ON "MeetingHistory"("userAId", "userBId");
CREATE INDEX IF NOT EXISTS "MeetingHistory_userAId_idx" ON "MeetingHistory"("userAId");
CREATE INDEX IF NOT EXISTS "MeetingHistory_userBId_idx" ON "MeetingHistory"("userBId");

-- PodFeedback
CREATE TABLE IF NOT EXISTS "PodFeedback" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "wouldMeetAgain" BOOLEAN NOT NULL DEFAULT false,
    "highlights" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PodFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PodFeedback_podId_fkey" FOREIGN KEY ("podId") REFERENCES "MatchmakingPod"("id") ON DELETE CASCADE,
    CONSTRAINT "PodFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PodFeedback_podId_userId_key" ON "PodFeedback"("podId", "userId");
