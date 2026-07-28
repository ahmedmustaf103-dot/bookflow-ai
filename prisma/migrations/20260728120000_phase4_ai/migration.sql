-- Phase 4: AI usage metering

CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "inputHash" TEXT,
    "outputPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_runs_organizationId_createdAt_idx" ON "ai_runs"("organizationId", "createdAt");
CREATE INDEX "ai_runs_organizationId_feature_idx" ON "ai_runs"("organizationId", "feature");

ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
