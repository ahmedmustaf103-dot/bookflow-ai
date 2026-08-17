-- Default rebooking nudge: 14 days after a completed visit (was 28).
ALTER TABLE "organizations"
  ALTER COLUMN "rebookingDaysAfter" SET DEFAULT 14;

UPDATE "organizations"
SET "rebookingDaysAfter" = 14
WHERE "rebookingDaysAfter" = 28;
