import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function isGoogleCalendarConfigured() {
  return Boolean(
    env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );
}

export function googleCalendarRedirectUri() {
  return `${env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;
}

export function buildGoogleCalendarAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: googleCalendarRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCalendarCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

async function getAccessToken(organizationId: string): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const conn = await db.googleCalendarConnection.findUnique({
    where: { organizationId },
  });
  if (!conn) return null;

  if (
    conn.accessToken &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return { accessToken: conn.accessToken, calendarId: conn.calendarId };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    logger.warn(
      { organizationId, status: res.status },
      "Google Calendar token refresh failed",
    );
    return null;
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  await db.googleCalendarConnection.update({
    where: { organizationId },
    data: {
      accessToken: data.access_token,
      accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return { accessToken: data.access_token, calendarId: conn.calendarId };
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

export async function pushGoogleCalendarUpsert(input: {
  organizationId: string;
  bookingId: string;
  googleEventId?: string | null;
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  if (!isGoogleCalendarConfigured()) return;
  try {
    const auth = await getAccessToken(input.organizationId);
    if (!auth) return;

    const body = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startAt.toISOString(),
        timeZone: input.timezone,
      },
      end: {
        dateTime: input.endAt.toISOString(),
        timeZone: input.timezone,
      },
    };

    let eventId = input.googleEventId ?? null;
    if (eventId) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (res.status === 404) {
        eventId = null;
      } else if (!res.ok) {
        logger.warn(
          { bookingId: input.bookingId, status: res.status },
          "Google Calendar event update failed",
        );
        return;
      }
    }

    if (!eventId) {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        logger.warn(
          { bookingId: input.bookingId, status: res.status },
          "Google Calendar event create failed",
        );
        return;
      }
      const created = (await res.json()) as { id?: string };
      if (created.id) {
        await db.booking.update({
          where: { id: input.bookingId },
          data: { googleEventId: created.id },
        });
      }
    }
  } catch (e) {
    logger.warn({ err: e, bookingId: input.bookingId }, "Google Calendar sync skipped");
  }
}

export async function pushGoogleCalendarCancel(input: {
  organizationId: string;
  bookingId: string;
  googleEventId?: string | null;
}) {
  if (!isGoogleCalendarConfigured() || !input.googleEventId) return;
  try {
    const auth = await getAccessToken(input.organizationId);
    if (!auth) return;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(input.googleEventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      logger.warn(
        { bookingId: input.bookingId, status: res.status },
        "Google Calendar event delete failed",
      );
      return;
    }
    await db.booking.update({
      where: { id: input.bookingId },
      data: { googleEventId: null },
    });
  } catch (e) {
    logger.warn(
      { err: e, bookingId: input.bookingId },
      "Google Calendar cancel skipped",
    );
  }
}
