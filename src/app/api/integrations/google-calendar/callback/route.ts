import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { db } from "@/server/db";
import { isDemoGuest } from "@/server/demo/session";
import {
  exchangeGoogleCalendarCode,
  fetchGoogleAccountEmail,
  isGoogleCalendarConfigured,
} from "@/server/integrations/google-calendar";
import { requireDbUser, requireMembership } from "@/server/auth/session";

const calendarPath = "/dashboard/settings/calendar";

export async function GET(request: Request) {
  const base = env.NEXT_PUBLIC_APP_URL;
  if (await isDemoGuest()) {
    return NextResponse.redirect(`${base}${calendarPath}`);
  }
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${base}${calendarPath}?gcal=not_configured`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !stateRaw) {
    return NextResponse.redirect(`${base}${calendarPath}?gcal=error`);
  }

  let organizationId: string;
  let stateUserId: string;
  try {
    const state = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf8"),
    ) as { organizationId: string; userId: string };
    organizationId = state.organizationId;
    stateUserId = state.userId;
  } catch {
    return NextResponse.redirect(`${base}${calendarPath}?gcal=error`);
  }

  try {
    const user = await requireDbUser();
    if (user.id !== stateUserId) {
      return NextResponse.redirect(`${base}${calendarPath}?gcal=error`);
    }
    await requireMembership(organizationId, "STAFF");
    const tokens = await exchangeGoogleCalendarCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${base}${calendarPath}?gcal=error`);
    }
    const email = await fetchGoogleAccountEmail(tokens.access_token);
    await db.googleCalendarConnection.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId,
        userId: user.id,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: email,
      },
      update: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        accountEmail: email,
      },
    });
    return NextResponse.redirect(`${base}${calendarPath}?gcal=connected`);
  } catch {
    return NextResponse.redirect(`${base}${calendarPath}?gcal=error`);
  }
}
