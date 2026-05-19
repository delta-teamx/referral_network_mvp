ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count") VALUES
(gen_random_uuid(), 'manual', '20260508120000_add_profile_photo', now(), 1);
