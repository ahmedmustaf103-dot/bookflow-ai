import { describe, expect, it } from "vitest";

import {
  PUBLIC_BOOKING_HORIZON_DAYS,
  addUtcDaysToYmd,
  groupSlotsByLocalDay,
  publicBookingHorizon,
} from "./booking-window";

describe("public booking window", () => {
  it("covers 28 local days including today", () => {
    const { fromDate, toDate } = publicBookingHorizon(
      "UTC",
      new Date("2026-08-20T15:00:00.000Z"),
    );
    expect(fromDate).toBe("2026-08-20");
    expect(toDate).toBe("2026-09-16");
    expect(PUBLIC_BOOKING_HORIZON_DAYS).toBe(28);
  });

  it("groups slots by location-local date and drops the 48-slot flattening", () => {
    const slots = [
      { start: new Date("2026-08-20T09:00:00.000Z") },
      { start: new Date("2026-08-20T09:30:00.000Z") },
      { start: new Date("2026-08-22T11:00:00.000Z") },
    ];
    const days = groupSlotsByLocalDay(slots, "UTC");
    expect(days).toHaveLength(2);
    expect(days[0]?.date).toBe("2026-08-20");
    expect(days[0]?.slots).toHaveLength(2);
    expect(days[1]?.date).toBe("2026-08-22");
    expect(days[1]?.slots[0]?.label).toBe("11:00");
  });

  it("fills empty days so today stays in the calendar strip", () => {
    const slots = [{ start: new Date("2026-08-22T11:00:00.000Z") }];
    const days = groupSlotsByLocalDay(slots, "UTC", {
      fromDate: "2026-08-20",
      toDate: "2026-08-22",
    });
    expect(days.map((d) => d.date)).toEqual([
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
    ]);
    expect(days[0]?.slots).toHaveLength(0);
    expect(days[2]?.slots).toHaveLength(1);
  });

  it("adds whole days on the YYYY-MM-DD calendar", () => {
    expect(addUtcDaysToYmd("2026-08-30", 7)).toBe("2026-09-06");
  });
});
