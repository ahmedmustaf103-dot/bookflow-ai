import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { requireMembership } from "@/server/auth/session";
import { db } from "@/server/db";
import { getActiveOrganization } from "@/server/tenant/context";

export async function POST() {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/sign-in`);
  }
  await requireMembership(ctx.organization.id, "STAFF");

  await db.googleCalendarConnection.deleteMany({
    where: {
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
    },
  });

  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/calendar?gcal=disconnected`,
  );
}
