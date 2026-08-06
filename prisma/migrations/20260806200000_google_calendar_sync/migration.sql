-- Google Calendar OAuth connection (per organization)
CREATE TABLE "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accountEmail" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_calendar_connections_organizationId_key" ON "google_calendar_connections"("organizationId");

ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional event id on bookings for push sync
ALTER TABLE "bookings" ADD COLUMN "googleEventId" TEXT;
