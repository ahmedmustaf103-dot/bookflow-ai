import "server-only";

import { env } from "@/lib/env";
import { db } from "@/server/db";
import { isGoogleCalendarConfigured } from "@/server/integrations/google-calendar";
import { buildPilotSetupItems, type SetupItem } from "./setup-items";

export async function getPilotSetupStatus(input: {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  reminderHoursBefore: number;
}): Promise<{ items: SetupItem[]; emailConfigured: boolean }> {
  const [hourCount, google, serviceCount, staffCount] = await Promise.all([
    db.availabilityRule.count({
      where: { resource: { organizationId: input.organizationId } },
    }),
    db.googleCalendarConnection.findFirst({
      where: { organizationId: input.organizationId },
      select: { id: true },
    }),
    db.service.count({
      where: { organizationId: input.organizationId, isActive: true },
    }),
    db.resource.count({
      where: { organizationId: input.organizationId, isActive: true },
    }),
  ]);

  const emailConfigured = Boolean(env.RESEND_API_KEY);
  const items = buildPilotSetupItems({
    hasBusinessName: input.name.trim().length >= 2,
    hasBranding: Boolean(input.logoUrl),
    hasServices: serviceCount > 0,
    hasStaff: staffCount > 0,
    hasHours: hourCount > 0,
    hasBookingLinkShared: false,
    remindersConfigured: input.reminderHoursBefore > 0,
    emailConfigured,
    googleConnected: Boolean(google) && isGoogleCalendarConfigured(),
  });

  return { items, emailConfigured };
}
