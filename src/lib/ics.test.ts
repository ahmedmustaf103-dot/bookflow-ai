import { describe, expect, it } from "vitest";

import { buildBookingIcs } from "./ics";

describe("buildBookingIcs", () => {
  it("builds a valid VEVENT with UTC start/end", () => {
    const ics = buildBookingIcs({
      uid: "booking-123@bookflow.ai",
      title: "Haircut with Jamie",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:booking-123@bookflow.ai");
    expect(ics).toContain("DTSTART:20260723T090000Z");
    expect(ics).toContain("DTEND:20260723T093000Z");
    expect(ics).toContain("SUMMARY:Haircut with Jamie");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    // CRLF line endings per RFC 5545
    expect(ics.includes("\r\n")).toBe(true);
  });

  it("escapes commas, semicolons, and newlines in text fields", () => {
    const ics = buildBookingIcs({
      uid: "booking-456@bookflow.ai",
      title: "Consult, Part 1; Follow-up",
      description: "Line one\nLine two, with; punctuation",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
    });

    expect(ics).toContain("SUMMARY:Consult\\, Part 1\\; Follow-up");
    expect(ics).toContain(
      "DESCRIPTION:Line one\\nLine two\\, with\\; punctuation",
    );
  });

  it("omits optional fields when not provided", () => {
    const ics = buildBookingIcs({
      uid: "booking-789@bookflow.ai",
      title: "Trial",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
    });

    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });
});
