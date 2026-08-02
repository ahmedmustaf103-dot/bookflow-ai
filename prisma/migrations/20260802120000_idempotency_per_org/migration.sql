-- Scope idempotency keys per organization (prevents cross-tenant lookup).
DROP INDEX IF EXISTS "bookings_idempotencyKey_key";

CREATE UNIQUE INDEX "bookings_organizationId_idempotencyKey_key"
  ON "bookings"("organizationId", "idempotencyKey");
