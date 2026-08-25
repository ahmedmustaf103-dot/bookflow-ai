import { describe, expect, it } from "vitest";

import {
  bookingIcsUid,
  buildBookingIcs,
  buildConfirmationIcs,
} from "./ics";

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
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("SEQUENCE:0");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("DTSTART:20260723T090000Z");
    expect(ics).toContain("DTEND:20260723T093000Z");
    expect(ics).toContain("SUMMARY:Haircut with Jamie");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
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

  it("builds a confirmation ICS with business, staff, and manage link", () => {
    const ics = buildConfirmationIcs({
      bookingId: "b1",
      organizationName: "Mustaf Barbers",
      serviceName: "Skin fade",
      resourceName: "Jamie",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:45:00.000Z"),
      manageUrl: "https://app.test/book/manage/tok",
    });
    expect(ics).toContain("SUMMARY:Skin fade at Mustaf Barbers");
    expect(ics).toContain(
      "DESCRIPTION:With Jamie\\nManage: https://app.test/book/manage/tok",
    );
    expect(ics).toContain("LOCATION:Mustaf Barbers");
    expect(ics).toContain(`UID:${bookingIcsUid("b1")}`);
    expect(ics).toContain("METHOD:REQUEST");
  });

  it("keeps a stable UID when the appointment time changes", () => {
    const original = buildConfirmationIcs({
      bookingId: "b1",
      organizationName: "Shop",
      serviceName: "Cut",
      resourceName: "Sam",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
      sequence: 0,
    });
    const updated = buildConfirmationIcs({
      bookingId: "b1",
      organizationName: "Shop",
      serviceName: "Cut",
      resourceName: "Sam",
      startAt: new Date("2026-07-30T14:00:00.000Z"),
      endAt: new Date("2026-07-30T14:30:00.000Z"),
      sequence: 1,
    });
    expect(original).toContain("UID:b1@bookflow.ai");
    expect(updated).toContain("UID:b1@bookflow.ai");
    expect(updated).toContain("DTSTART:20260730T140000Z");
    expect(updated).toContain("DTEND:20260730T143000Z");
    expect(updated).toContain("SEQUENCE:1");
    expect(original).toContain("SEQUENCE:0");
  });

  it("builds a cancellation ICS with METHOD:CANCEL and the same UID", () => {
    const ics = buildConfirmationIcs({
      bookingId: "b1",
      organizationName: "Shop",
      serviceName: "Cut",
      resourceName: "Sam",
      startAt: new Date("2026-07-23T09:00:00.000Z"),
      endAt: new Date("2026-07-23T09:30:00.000Z"),
      sequence: 2,
      method: "CANCEL",
    });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("UID:b1@bookflow.ai");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("SUMMARY:Cancelled: Cut at Shop");
  });
});
