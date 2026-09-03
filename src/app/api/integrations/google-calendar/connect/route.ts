import { NextResponse } from "next/server";

import { requireMembership } from "@/server/auth/session";
import { isDemoGuest } from "@/server/demo/session";
import {
  buildGoogleCalendarAuthUrl,
  isGoogleCalendarConfigured,
} from "@/server/integrations/google-calendar";
import { getActiveOrganization } from "@/server/tenant/context";

const calendarPath = "/dashboard/settings/calendar";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (await isDemoGuest()) {
    return NextResponse.redirect(new URL(calendarPath, base));
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(
      new URL(`${calendarPath}?gcal=not_configured`, base),
    );
  }

  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return NextResponse.redirect(new URL("/sign-in", base));
  }
  await requireMembership(ctx.organization.id, "STAFF");

  const state = Buffer.from(
    JSON.stringify({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      t: Date.now(),
    }),
  ).toString("base64url");

  return NextResponse.redirect(buildGoogleCalendarAuthUrl(state));
}
