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

const { findUnique, connUpdate, bookingUpdate } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  connUpdate: vi.fn(),
  bookingUpdate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    googleCalendarConnection: {
      findUnique,
      update: connUpdate,
    },
    booking: { update: bookingUpdate },
  },
}));

import {
  pushGoogleCalendarCancel,
  pushGoogleCalendarUpsert,
} from "./google-calendar";

function connectedAuth() {
  findUnique.mockResolvedValue({
    accessToken: "ya29.test",
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
    calendarId: "primary",
    refreshToken: "refresh",
  });
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

  it("creates an event and stores googleEventId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "evt_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
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
    expect(bookingUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { googleEventId: "evt_1" },
    });
  });

  it("patches an existing event on reschedule", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "evt_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarUpsert({
      organizationId: "org1",
      bookingId: "b1",
      googleEventId: "evt_1",
      summary: "Cut · Alex",
      startAt: new Date("2026-08-20T11:00:00.000Z"),
      endAt: new Date("2026-08-20T11:30:00.000Z"),
      timezone: "UTC",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events/evt_1"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(bookingUpdate).not.toHaveBeenCalled();
  });

  it("deletes the event on cancel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await pushGoogleCalendarCancel({
      organizationId: "org1",
      bookingId: "b1",
      googleEventId: "evt_1",
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
        bookingId: "b1",
        googleEventId: "evt_1",
      }),
    ).resolves.toBeUndefined();
  });
});
