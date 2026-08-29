-- Per-barber Google Calendar: one connection per team member.
ALTER TABLE "google_calendar_connections" ADD COLUMN "userId" TEXT;

UPDATE "google_calendar_connections" AS g
SET "userId" = (
  SELECT m."userId"
  FROM "memberships" AS m
  WHERE m."organizationId" = g."organizationId"
    AND m.status = 'ACTIVE'
  ORDER BY
    CASE m.role
      WHEN 'OWNER' THEN 1
      WHEN 'ADMIN' THEN 2
      WHEN 'STAFF' THEN 3
      ELSE 4
    END,
    m."createdAt" ASC
  LIMIT 1
);

DELETE FROM "google_calendar_connections" WHERE "userId" IS NULL;

ALTER TABLE "google_calendar_connections" ALTER COLUMN "userId" SET NOT NULL;

DROP INDEX "google_calendar_connections_organizationId_key";

CREATE UNIQUE INDEX "google_calendar_connections_organizationId_userId_key" ON "google_calendar_connections"("organizationId", "userId");

CREATE INDEX "google_calendar_connections_userId_idx" ON "google_calendar_connections"("userId");

ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
