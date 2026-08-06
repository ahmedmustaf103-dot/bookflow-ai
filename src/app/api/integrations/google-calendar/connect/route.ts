import { NextResponse } from "next/server";

import { requireMembership } from "@/server/auth/session";
import {
  buildGoogleCalendarAuthUrl,
  isGoogleCalendarConfigured,
} from "@/server/integrations/google-calendar";
import { getActiveOrganization } from "@/server/tenant/context";

export async function GET() {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?gcal=not_configured",
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      ),
    );
  }

  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return NextResponse.redirect(
      new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    );
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const state = Buffer.from(
    JSON.stringify({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      t: Date.now(),
    }),
  ).toString("base64url");

  return NextResponse.redirect(buildGoogleCalendarAuthUrl(state));
}
