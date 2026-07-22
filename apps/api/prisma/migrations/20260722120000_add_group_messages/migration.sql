-- Group chat: messages posted inside a group by its members.
CREATE TABLE IF NOT EXISTS "GroupMessage" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx"
  ON "GroupMessage" ("groupId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "GroupMessage"
    ADD CONSTRAINT "GroupMessage_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupMessage"
    ADD CONSTRAINT "GroupMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
