-- Client self-serve manage links
ALTER TABLE "bookings" ADD COLUMN "manageToken" TEXT;

UPDATE "bookings"
SET "manageToken" = md5(random()::text || id || clock_timestamp()::text)
WHERE "manageToken" IS NULL;

ALTER TABLE "bookings" ALTER COLUMN "manageToken" SET NOT NULL;

CREATE UNIQUE INDEX "bookings_manageToken_key" ON "bookings"("manageToken");
