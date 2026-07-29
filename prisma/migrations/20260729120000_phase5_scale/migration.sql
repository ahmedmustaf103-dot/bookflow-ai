-- Phase 5: exclusion constraint + vertical pack

-- Harden overlap prevention at the DB layer for active bookings.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_resource_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));

-- Vertical pack for terminology / seed defaults (config key, not a fork).
ALTER TABLE "organizations"
  ADD COLUMN "verticalPack" TEXT NOT NULL DEFAULT 'barber_salon';
