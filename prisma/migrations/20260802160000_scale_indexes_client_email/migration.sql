-- Deduplicate clients sharing (organizationId, email); keep oldest, re-point bookings.
WITH ranked AS (
  SELECT
    id,
    "organizationId",
    email,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", email
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM clients
  WHERE email IS NOT NULL
),
dupes AS (
  SELECT id, "organizationId", email FROM ranked WHERE rn > 1
),
keepers AS (
  SELECT id, "organizationId", email FROM ranked WHERE rn = 1
)
UPDATE bookings b
SET "clientId" = k.id
FROM dupes d
JOIN keepers k
  ON k."organizationId" = d."organizationId"
 AND k.email = d.email
WHERE b."clientId" = d.id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", email
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM clients
  WHERE email IS NOT NULL
)
DELETE FROM clients
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Partial unique: one email per org when present
CREATE UNIQUE INDEX IF NOT EXISTS "clients_organizationId_email_unique"
  ON "clients" ("organizationId", email)
  WHERE email IS NOT NULL;

-- Booking hot-path indexes
CREATE INDEX IF NOT EXISTS "bookings_organizationId_createdAt_idx"
  ON "bookings" ("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "bookings_organizationId_status_startAt_idx"
  ON "bookings" ("organizationId", status, "startAt");

CREATE INDEX IF NOT EXISTS "bookings_resourceId_status_startAt_idx"
  ON "bookings" ("resourceId", status, "startAt");
