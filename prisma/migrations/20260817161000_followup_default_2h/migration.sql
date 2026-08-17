-- Thank-you / follow-up email: 2 hours after a completed visit (was 24).
ALTER TABLE "organizations"
  ALTER COLUMN "followUpHoursAfter" SET DEFAULT 2;

UPDATE "organizations"
SET "followUpHoursAfter" = 2
WHERE "followUpHoursAfter" = 24;
