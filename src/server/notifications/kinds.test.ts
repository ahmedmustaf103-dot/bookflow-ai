import { describe, expect, it } from "vitest";

import {
  bookingDedupeKey,
  CANCEL_ON_BOOKING_CANCEL,
  IMMEDIATE_OUTBOX_KINDS,
  MARKETING_OUTBOX_KINDS,
  OUTBOX_KINDS,
  ownerNotifyDedupeKey,
  reminderDedupeKey,
  rescheduleDedupeKey,
  staffCancelDedupeKey,
  staffRescheduleDedupeKey,
  uniqueOwnerNotifyEmails,
} from "@/server/notifications/kinds";

describe("outbox kinds", () => {
  it("covers confirmation, owner notify, cancel, reschedule, reminder, and post-visit", () => {
    expect(Object.values(OUTBOX_KINDS)).toEqual(
      expect.arrayContaining([
        "BOOKING_CONFIRMATION",
        "BOOKING_CREATED",
        "BOOKING_CANCELLATION",
        "BOOKING_RESCHEDULED",
        "BOOKING_REMINDER",
        "FOLLOW_UP",
        "REVIEW_REQUEST",
        "REBOOKING_REMINDER",
      ]),
    );
  });

  it("builds stable booking dedupe keys", () => {
    expect(bookingDedupeKey(OUTBOX_KINDS.BOOKING_CONFIRMATION, "b1")).toBe(
      "BOOKING_CONFIRMATION:b1:EMAIL",
    );
    expect(bookingDedupeKey(OUTBOX_KINDS.FOLLOW_UP, "b1")).toBe(
      "FOLLOW_UP:b1:EMAIL",
    );
    expect(ownerNotifyDedupeKey("b1", "Owner@Shop.test")).toBe(
      "BOOKING_CREATED:b1:EMAIL:owner@shop.test",
    );
  });

  it("includes start time in reminder dedupe so reschedule can re-enqueue", () => {
    const start = new Date("2026-08-10T15:00:00.000Z");
    expect(reminderDedupeKey("b1", "EMAIL", start)).toBe(
      "BOOKING_REMINDER:b1:EMAIL:2026-08-10T15:00:00.000Z",
    );
    expect(reminderDedupeKey("b1", "SMS", start)).toContain(":SMS:");
  });

  it("includes start time in reschedule dedupe so each move notifies once", () => {
    const start = new Date("2026-08-10T16:00:00.000Z");
    expect(rescheduleDedupeKey("b1", start)).toBe(
      "BOOKING_RESCHEDULED:b1:EMAIL:2026-08-10T16:00:00.000Z",
    );
    expect(staffRescheduleDedupeKey("b1", "Barber@Shop.test", start)).toBe(
      "STAFF_BOOKING_RESCHEDULED:b1:EMAIL:barber@shop.test:2026-08-10T16:00:00.000Z",
    );
    expect(staffCancelDedupeKey("b1", "Barber@Shop.test")).toBe(
      "STAFF_BOOKING_CANCELLED:b1:EMAIL:barber@shop.test",
    );
  });

  it("marks confirmation/owner/cancel/reschedule as immediate flush kinds", () => {
    expect(IMMEDIATE_OUTBOX_KINDS).toEqual(
      expect.arrayContaining([
        "BOOKING_CONFIRMATION",
        "BOOKING_CREATED",
        "BOOKING_CANCELLATION",
        "BOOKING_RESCHEDULED",
        "STAFF_BOOKING_RESCHEDULED",
        "STAFF_BOOKING_CANCELLED",
      ]),
    );
    expect(IMMEDIATE_OUTBOX_KINDS).not.toContain("BOOKING_REMINDER");
  });

  it("lists marketing kinds that require opt-in", () => {
    expect(MARKETING_OUTBOX_KINDS).toEqual([
      "FOLLOW_UP",
      "REVIEW_REQUEST",
      "REBOOKING_REMINDER",
    ]);
  });

  it("cancels pending post-visit jobs with reminders on booking cancel", () => {
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("BOOKING_REMINDER");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("BOOKING_RESCHEDULED");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("STAFF_BOOKING_RESCHEDULED");
    expect(CANCEL_ON_BOOKING_CANCEL).not.toContain("STAFF_BOOKING_CANCELLED");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("FOLLOW_UP");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("REVIEW_REQUEST");
    expect(CANCEL_ON_BOOKING_CANCEL).toContain("REBOOKING_REMINDER");
    expect(CANCEL_ON_BOOKING_CANCEL).not.toContain("BOOKING_CONFIRMATION");
    expect(CANCEL_ON_BOOKING_CANCEL).not.toContain("BOOKING_CREATED");
  });

  it("dedupes owner notify emails case-insensitively", () => {
    expect(
      uniqueOwnerNotifyEmails([
        "Owner@Shop.test",
        " owner@shop.test ",
        "admin@shop.test",
        null,
        "",
      ]),
    ).toEqual(["owner@shop.test", "admin@shop.test"]);
  });
});
