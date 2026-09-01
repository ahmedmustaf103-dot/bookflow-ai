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

export async function resolveGoogleCalendarUserId(input: {
  organizationId: string;
  userId?: string | null;
  resourceId?: string | null;
}): Promise<string | null> {
  if (input.userId) return input.userId;
  if (input.resourceId) {
    const resource = await db.resource.findFirst({
      where: { id: input.resourceId, organizationId: input.organizationId },
      select: { userId: true },
    });
    if (resource?.userId) return resource.userId;
  }
  const owner = await db.membership.findFirst({
    where: {
      organizationId: input.organizationId,
      role: "OWNER",
      status: "ACTIVE",
    },
    select: { userId: true },
  });
  return owner?.userId ?? null;
}

async function findConnection(organizationId: string, userId: string) {
  return db.googleCalendarConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

async function getAccessToken(input: {
  organizationId: string;
  userId?: string | null;
  resourceId?: string | null;
}): Promise<{
  accessToken: string;
  calendarId: string;
} | null> {
  const preferredUserId = await resolveGoogleCalendarUserId(input);
  if (!preferredUserId) return null;

  let conn = await findConnection(input.organizationId, preferredUserId);
  if (!conn) {
    const owner = await db.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        role: "OWNER",
        status: "ACTIVE",
      },
      select: { userId: true },
    });
    if (owner && owner.userId !== preferredUserId) {
      conn = await findConnection(input.organizationId, owner.userId);
    }
  }
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
      { organizationId: input.organizationId, status: res.status },
      "Google Calendar token refresh failed",
    );
    return null;
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  await db.googleCalendarConnection.update({
    where: { id: conn.id },
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

/**
 * Google Calendar event IDs must be base32hex (`[0-9a-v]`, 5–1024 chars).
 * Hex of the booking id is a stable subset, so reschedule/cancel can address
 * the same event even if `googleEventId` has not been persisted yet.
 */
export function googleEventIdForBooking(bookingId: string): string {
  return `bf1${Buffer.from(bookingId, "utf8").toString("hex")}`;
}

function eventUrl(calendarId: string, eventId?: string) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function storedGoogleEventId(bookingId: string): Promise<string | null> {
  const row = await db.booking.findUnique({
    where: { id: bookingId },
    select: { googleEventId: true },
  });
  return row?.googleEventId ?? null;
}

async function persistGoogleEventId(
  bookingId: string,
  googleEventId: string | null,
) {
  await db.booking.update({
    where: { id: bookingId },
    data: { googleEventId },
  });
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function pushGoogleCalendarUpsert(input: {
  organizationId: string;
  bookingId: string;
  resourceId?: string | null;
  userId?: string | null;
  googleEventId?: string | null;
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
}) {
  if (!isGoogleCalendarConfigured()) return;
  try {
    const auth = await getAccessToken(input);
    if (!auth) return;
    const { accessToken, calendarId } = auth;

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

    const stored = await storedGoogleEventId(input.bookingId);
    const deterministic = googleEventIdForBooking(input.bookingId);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    async function patch(eventId: string): Promise<"ok" | "missing" | "error"> {
      const res = await fetch(eventUrl(calendarId, eventId), {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      if (res.ok) return "ok";
      if (res.status === 404 || res.status === 410) return "missing";
      logger.warn(
        { bookingId: input.bookingId, status: res.status, eventId },
        "Google Calendar event update failed",
      );
      return "error";
    }

    for (const eventId of uniqueIds([stored, input.googleEventId])) {
      const result = await patch(eventId);
      if (result === "ok") {
        if (stored !== eventId) {
          await persistGoogleEventId(input.bookingId, eventId);
        }
        return;
      }
      if (result === "error") return;
    }

    const createRes = await fetch(eventUrl(calendarId), {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, id: deterministic }),
    });

    if (createRes.status === 409) {
      const patched = await patch(deterministic);
      if (patched === "ok") {
        await persistGoogleEventId(input.bookingId, deterministic);
      }
      return;
    }

    if (!createRes.ok) {
      logger.warn(
        { bookingId: input.bookingId, status: createRes.status },
        "Google Calendar event create failed",
      );
      return;
    }

    const created = (await createRes.json()) as { id?: string };
    await persistGoogleEventId(input.bookingId, created.id ?? deterministic);
  } catch (e) {
    logger.warn(
      { err: e, bookingId: input.bookingId },
      "Google Calendar sync skipped",
    );
  }
}

export async function pushGoogleCalendarCancel(input: {
  organizationId: string;
  bookingId: string;
  resourceId?: string | null;
  userId?: string | null;
  googleEventId?: string | null;
}) {
  if (!isGoogleCalendarConfigured()) return;
  try {
    const auth = await getAccessToken(input);
    if (!auth) return;

    const stored = await storedGoogleEventId(input.bookingId);
    const candidates = uniqueIds([
      stored,
      input.googleEventId,
      googleEventIdForBooking(input.bookingId),
    ]);
    if (candidates.length === 0) return;

    let failed = false;
    let gone = false;
    for (const eventId of candidates) {
      const res = await fetch(eventUrl(auth.calendarId, eventId), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (res.ok || res.status === 404 || res.status === 410) {
        gone = true;
        if (res.ok) break;
        continue;
      }
      logger.warn(
        { bookingId: input.bookingId, status: res.status, eventId },
        "Google Calendar event delete failed",
      );
      failed = true;
    }

    if (failed) return;
    if (gone || stored) {
      await persistGoogleEventId(input.bookingId, null);
    }
  } catch (e) {
    logger.warn(
      { err: e, bookingId: input.bookingId },
      "Google Calendar cancel skipped",
    );
  }
}
