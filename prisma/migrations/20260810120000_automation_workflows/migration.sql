-- Sprint 5: automation settings + outbox dedupe
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "followUpEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "followUpHoursAfter" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "reviewRequestEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reviewRequestHoursAfter" INTEGER NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS "reviewUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "rebookingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "rebookingDaysAfter" INTEGER NOT NULL DEFAULT 28;

ALTER TABLE "notification_outbox"
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "notification_outbox_dedupeKey_key"
  ON "notification_outbox"("dedupeKey");
