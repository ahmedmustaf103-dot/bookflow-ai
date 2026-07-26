-- Phase 3: CRM tags, reminders outbox, audit log, org settings

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "OutboxChannel" AS ENUM ('EMAIL');

ALTER TABLE "organizations" ADD COLUMN "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "organizations" ADD COLUMN "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "clients" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT,
    "channel" "OutboxChannel" NOT NULL DEFAULT 'EMAIL',
    "kind" TEXT NOT NULL,
    "toAddress" TEXT,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_outbox_status_scheduledFor_idx" ON "notification_outbox"("status", "scheduledFor");
CREATE INDEX "notification_outbox_organizationId_status_idx" ON "notification_outbox"("organizationId", "status");
CREATE INDEX "notification_outbox_bookingId_idx" ON "notification_outbox"("bookingId");
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
