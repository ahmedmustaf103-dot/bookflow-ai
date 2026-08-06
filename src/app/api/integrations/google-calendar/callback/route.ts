import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { db } from "@/server/db";
import {
  exchangeGoogleCalendarCode,
  fetchGoogleAccountEmail,
  isGoogleCalendarConfigured,
} from "@/server/integrations/google-calendar";
import { requireMembership } from "@/server/auth/session";

export async function GET(request: Request) {
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${base}/dashboard/settings?gcal=not_configured`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err || !code || !stateRaw) {
    return NextResponse.redirect(`${base}/dashboard/settings?gcal=error`);
  }

  let organizationId: string;
  try {
    const state = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf8"),
    ) as { organizationId: string };
    organizationId = state.organizationId;
  } catch {
    return NextResponse.redirect(`${base}/dashboard/settings?gcal=error`);
  }

  try {
    await requireMembership(organizationId, "ADMIN");
    const tokens = await exchangeGoogleCalendarCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${base}/dashboard/settings?gcal=error`);
    }
    const email = await fetchGoogleAccountEmail(tokens.access_token);
    await db.googleCalendarConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(
          Date.now() + tokens.expires_in * 1000,
        ),
        accountEmail: email,
      },
      update: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(
          Date.now() + tokens.expires_in * 1000,
        ),
        accountEmail: email,
      },
    });
    return NextResponse.redirect(`${base}/dashboard/settings?gcal=connected`);
  } catch {
    return NextResponse.redirect(`${base}/dashboard/settings?gcal=error`);
  }
}
