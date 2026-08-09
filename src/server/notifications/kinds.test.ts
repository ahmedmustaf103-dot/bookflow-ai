import { describe, expect, it } from "vitest";

import {
  bookingDedupeKey,
  CANCEL_ON_BOOKING_CANCEL,
  OUTBOX_KINDS,
  reminderDedupeKey,
} from "@/server/notifications/kinds";

describe("outbox kinds", () => {
  it("covers all Sprint 5 workflows", () => {
    expect(Object.values(OUTBOX_KINDS)).toEqual(
      expect.arrayContaining([
        "BOOKING_CONFIRMATION",
        "BOOKING_CANCELLATION",
        "BOOKING_REMINDER",
        "FOLLOW_UP",
        "REVIEW_REQUEST",
        "REBOOKING_REMINDER",
      ]),
    );
  });

  it("builds stable booking dedupe keys", () => {
    expect(
      bookingDedupeKey(OUTBOX_KINDS.BOOKING_CONFIRMATION, "b1"),
    ).toBe("BOOKING_CONFIRMATION:b1:EMAIL");
    expect(bookingDedupeKey(OUTBOX_KINDS.FOLLOW_UP, "b1")).toBe(
      "FOLLOW_UP:b1:EMAIL",
    );
  });

  it("includes start time in reminder dedupe so reschedule can re-enqueue", () => {
    const start = new Date("2026-08-10T15:00:00.000Z");
    expect(reminderDedupeKey("b1", "EMAIL", start)).toBe(
      "BOOKING_REMINDER:b1:EMAIL:2026-08-10T15:00:00.000Z",
    );
    expect(reminderDedupeKey("b1", "SMS", start)).toContain(":SMS:");
  });

  it("cancels pending post-visit jobs with reminders on booking cancel", () => {
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("BOOKING_REMINDER");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("FOLLOW_UP");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("REVIEW_REQUEST");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("REBOOKING_REMINDER");
    expect(CANCEL_ON_BOOKING_CANCEL).not.toContain("BOOKING_CONFIRMATION");
  });
});
