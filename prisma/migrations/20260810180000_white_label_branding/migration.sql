-- Sprint 7: white-label branding + custom domain prep
CREATE TYPE "CustomDomainStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'FAILED');

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brandPrimary" TEXT DEFAULT '#0F6E56',
  ADD COLUMN IF NOT EXISTS "customDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "customDomainStatus" "CustomDomainStatus" NOT NULL DEFAULT 'NONE';

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_customDomain_key"
  ON "organizations"("customDomain");
