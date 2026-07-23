import { describe, expect, it } from "vitest";

import { formatDateInTimeZone, generateSlots, zonedLocalToUtc } from "./engine";

describe("zonedLocalToUtc", () => {
  it("maps UTC wall time correctly", () => {
    const d = zonedLocalToUtc("2026-07-23", 9 * 60, "UTC");
    expect(d.toISOString()).toBe("2026-07-23T09:00:00.000Z");
  });

  it("maps America/New_York summer time (EDT, UTC-4)", () => {
    const d = zonedLocalToUtc("2026-07-23", 9 * 60, "America/New_York");
    expect(d.toISOString()).toBe("2026-07-23T13:00:00.000Z");
  });
});

describe("generateSlots", () => {
  it("returns 30-min slots within a single open window", () => {
    const slots = generateSlots({
      timezone: "UTC",
      fromDate: "2026-07-23",
      toDate: "2026-07-23",
      durationMin: 30,
      slotIntervalMin: 30,
      rules: [{ weekday: 4, startMin: 9 * 60, endMin: 11 * 60 }], // Thu
      now: new Date("2026-07-01T00:00:00Z"),
    });

    expect(slots).toHaveLength(4);
    expect(slots[0].start.toISOString()).toBe("2026-07-23T09:00:00.000Z");
    expect(slots[3].start.toISOString()).toBe("2026-07-23T10:30:00.000Z");
  });

  it("respects closed overrides", () => {
    const slots = generateSlots({
      timezone: "UTC",
      fromDate: "2026-07-23",
      toDate: "2026-07-23",
      durationMin: 30,
      rules: [{ weekday: 4, startMin: 9 * 60, endMin: 12 * 60 }],
      overrides: [{ date: "2026-07-23", isClosed: true }],
      now: new Date("2026-07-01T00:00:00Z"),
    });
    expect(slots).toHaveLength(0);
  });

  it("skips slots that collide with busy intervals + buffers", () => {
    const slots = generateSlots({
      timezone: "UTC",
      fromDate: "2026-07-23",
      toDate: "2026-07-23",
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 15,
      slotIntervalMin: 60,
      rules: [{ weekday: 4, startMin: 9 * 60, endMin: 13 * 60 }],
      busy: [
        {
          start: new Date("2026-07-23T10:00:00Z"),
          end: new Date("2026-07-23T11:00:00Z"),
        },
      ],
      now: new Date("2026-07-01T00:00:00Z"),
    });

    const starts = slots.map((s) => s.start.toISOString());
    // 09:00 needs free until 10:15 → conflicts with 10:00 busy
    expect(starts).not.toContain("2026-07-23T09:00:00.000Z");
    expect(starts).not.toContain("2026-07-23T10:00:00.000Z");
    // 11:00 needs free until 12:15 → no overlap with busy ending 11:00
    expect(starts).toContain("2026-07-23T11:00:00.000Z");
    expect(starts).toContain("2026-07-23T12:00:00.000Z");
  });

  it("formatDateInTimeZone matches eng-CA", () => {
    expect(formatDateInTimeZone(new Date("2026-07-23T20:00:00Z"), "UTC")).toBe(
      "2026-07-23",
    );
  });
});
