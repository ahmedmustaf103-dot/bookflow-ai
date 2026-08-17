import { describe, expect, it } from "vitest";

import { splitFloorBookings } from "@/server/analytics/floor";

function booking(id: string, start: string, end: string) {
  return {
    id,
    startAt: new Date(start),
    endAt: new Date(end),
  };
}

describe("splitFloorBookings", () => {
  const now = new Date("2026-08-17T11:10:00.000Z");

  it("picks the in-progress appointment as current", () => {
    const open = [
      booking("sarah", "2026-08-17T11:00:00.000Z", "2026-08-17T11:30:00.000Z"),
      booking("john", "2026-08-17T12:00:00.000Z", "2026-08-17T12:30:00.000Z"),
    ];
    const { current, upcoming } = splitFloorBookings(open, now);
    expect(current?.id).toBe("sarah");
    expect(upcoming.map((b) => b.id)).toEqual(["john"]);
  });

  it("keeps an overdue uncompleted visit as current", () => {
    const open = [
      booking("sarah", "2026-08-17T10:00:00.000Z", "2026-08-17T10:30:00.000Z"),
      booking("john", "2026-08-17T12:00:00.000Z", "2026-08-17T12:30:00.000Z"),
    ];
    const { current, upcoming } = splitFloorBookings(open, now);
    expect(current?.id).toBe("sarah");
    expect(upcoming.map((b) => b.id)).toEqual(["john"]);
  });

  it("has no current when everything is still upcoming", () => {
    const open = [
      booking("john", "2026-08-17T12:00:00.000Z", "2026-08-17T12:30:00.000Z"),
    ];
    const { current, upcoming } = splitFloorBookings(open, now);
    expect(current).toBeNull();
    expect(upcoming.map((b) => b.id)).toEqual(["john"]);
  });
});
