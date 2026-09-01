import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: {
    GOOGLE_CALENDAR_CLIENT_ID: "test-client",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test-secret",
    NEXT_PUBLIC_APP_URL: "https://app.test",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const {
  findUnique,
  connUpdate,
  bookingUpdate,
  resourceFindFirst,
  membershipFindFirst,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  connUpdate: vi.fn(),
  bookingUpdate: vi.fn(),
  resourceFindFirst: vi.fn(),
  membershipFindFirst: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    googleCalendarConnection: {
      findUnique,
      update: connUpdate,
    },
    booking: { update: bookingUpdate, findUnique: findUnique },
    resource: { findFirst: resourceFindFirst },
    membership: { findFirst: membershipFindFirst },
  },
}));

import {
  googleEventIdForBooking,
  pushGoogleCalendarCancel,
  pushGoogleCalendarUpsert,
  resolveGoogleCalendarUserId,
} from "./google-calendar";

function isConnectionLookup(args: {
  where?: { organizationId_userId?: { userId: string }; id?: string };
}) {
  return Boolean(args.where?.organizationId_userId);
}

function connectedAuth() {
  findUnique.mockImplementation(
    async (args: {
      where?: { organizationId_userId?: { userId: string }; id?: string };
    }) => {
      if (isConnectionLookup(args)) {
        return {
          id: "conn1",
          accessToken: "ya29.test",
          accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
          calendarId: "primary",
          refreshToken: "refresh",
        };
      }
      return { googleEventId: null };
    },
  );
}

function storedEvent(eventId: string | null) {
  findUnique.mockImplementation(
    async (args: {
      where?: { organizationId_userId?: { userId: string }; id?: string };
    }) => {
      if (isConnectionLookup(args)) {
        return {
          id: "conn1",
          accessToken: "ya29.test",
          accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
          calendarId: "primary",
          refreshToken: "refresh",
        };
      }
      return { googleEventId: eventId };
    },
  );
}

describe("Google Calendar one-way sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectedAuth();
    bookingUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an event with a deterministic id and stores googleEventId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: googleEventIdForBooking("b1") }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
      summary: "Cut · Alex",
      startAt: new Date("2026-08-20T10:00:00.000Z"),
      endAt: new Date("2026-08-20T10:30:00.000Z"),
      timezone: "UTC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/calendars/primary/events"),
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    ) as { id: string };
    expect(body.id).toBe(googleEventIdForBooking("b1"));
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: googleEventIdForBooking("b1") },
    });
  });

  it("patches the stored event on reschedule instead of creating another", async () => {
    storedEvent("evt_1");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "evt_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
      googleEventId: null,
      summary: "Cut · Alex",
      startAt: new Date("2026-08-20T11:00:00.000Z"),
      endAt: new Date("2026-08-20T11:30:00.000Z"),
      timezone: "UTC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events/evt_1"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(
      fetchMock.mock.calls.some(
        (call) => (call[1] as { method?: string }).method === "POST",
      ),
    ).toBe(false);
  });

  it("patches the event id passed by the caller when the DB has not stored it yet", async () => {
    connectedAuth();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "evt_hint" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
      googleEventId: "evt_hint",
      summary: "Cut · Alex",
      startAt: new Date("2026-08-20T11:00:00.000Z"),
      endAt: new Date("2026-08-20T11:30:00.000Z"),
      timezone: "UTC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events/evt_hint"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("deletes the stored event on cancel even if the caller omitted googleEventId", async () => {
    storedEvent("evt_1");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarCancel({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
      googleEventId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events/evt_1"),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: null },
    });
  });

  it("still deletes using the deterministic id when nothing is stored", async () => {
    connectedAuth();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarCancel({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/events/${googleEventIdForBooking("b1")}`),
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: null },
    });
  });

  it("treats a 409 on create as the existing event and patches it", async () => {
    connectedAuth();
    const deterministic = googleEventIdForBooking("b1");
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string, init: { method?: string }) => {
        if (init.method === "POST") {
          return { ok: false, status: 409, json: async () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: deterministic }),
        };
      });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
      userId: "u1",
      bookingId: "b1",
      summary: "Cut · Alex",
      startAt: new Date("2026-08-20T10:00:00.000Z"),
      endAt: new Date("2026-08-20T10:30:00.000Z"),
      timezone: "UTC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/events/${deterministic}`),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: deterministic },
    });
  });

  it("does not throw when Google returns an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      pushGoogleCalendarUpsert({
        organizationId: "org1",
        userId: "u1",
        bookingId: "b1",
        summary: "Cut · Alex",
        startAt: new Date("2026-08-20T10:00:00.000Z"),
        endAt: new Date("2026-08-20T10:30:00.000Z"),
        timezone: "UTC",
      }),
    ).resolves.toBeUndefined();
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it("does not throw when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      pushGoogleCalendarCancel({
        organizationId: "org1",
        userId: "u1",
        bookingId: "b1",
        googleEventId: "evt_1",
      }),
    ).resolves.toBeUndefined();
  });

  it("uses only base32hex characters for deterministic event ids", () => {
    const id = googleEventIdForBooking("clxyzBooking_01");
    expect(id).toMatch(/^[0-9a-v]+$/);
    expect(id.length).toBeGreaterThanOrEqual(5);
  });

  it("resolves the assigned barber before the shop owner", async () => {
    resourceFindFirst.mockResolvedValue({ userId: "barber-1" });
    await expect(
      resolveGoogleCalendarUserId({
        organizationId: "org1",
        resourceId: "chair-1",
      }),
    ).resolves.toBe("barber-1");
    expect(membershipFindFirst).not.toHaveBeenCalled();
  });

  it("falls back to the owner when the chair has no login", async () => {
    resourceFindFirst.mockResolvedValue({ userId: null });
    membershipFindFirst.mockResolvedValue({ userId: "owner-1" });
    await expect(
      resolveGoogleCalendarUserId({
        organizationId: "org1",
        resourceId: "chair-1",
      }),
    ).resolves.toBe("owner-1");
  });
});
