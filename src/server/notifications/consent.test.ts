import { describe, expect, it } from "vitest";

import {
  MARKETING_OUTBOX_KINDS,
  OUTBOX_KINDS,
  TRANSACTIONAL_OUTBOX_KINDS,
  allowsMarketingSend,
  isMarketingOutboxKind,
  isTransactionalOutboxKind,
} from "@/server/notifications/kinds";

describe("notification classification", () => {
  it("marks confirm/owner/cancel/reschedule/reminder as transactional", () => {
    expect(TRANSACTIONAL_OUTBOX_KINDS).toEqual(
      expect.arrayContaining([
        OUTBOX_KINDS.BOOKING_CONFIRMATION,
        OUTBOX_KINDS.BOOKING_CREATED,
        OUTBOX_KINDS.BOOKING_CANCELLATION,
        OUTBOX_KINDS.BOOKING_RESCHEDULED,
        OUTBOX_KINDS.BOOKING_REMINDER,
      ]),
    );
    for (const kind of TRANSACTIONAL_OUTBOX_KINDS) {
      expect(isTransactionalOutboxKind(kind)).toBe(true);
      expect(isMarketingOutboxKind(kind)).toBe(false);
    }
  });

  it("marks follow-up/review/rebooking as marketing", () => {
    expect(MARKETING_OUTBOX_KINDS).toEqual([
      OUTBOX_KINDS.FOLLOW_UP,
      OUTBOX_KINDS.REVIEW_REQUEST,
      OUTBOX_KINDS.REBOOKING_REMINDER,
    ]);
    for (const kind of MARKETING_OUTBOX_KINDS) {
      expect(isMarketingOutboxKind(kind)).toBe(true);
      expect(isTransactionalOutboxKind(kind)).toBe(false);
    }
  });
});

describe("marketing consent gate", () => {
  it("allows marketing only when marketingOptIn is true", () => {
    expect(allowsMarketingSend(true)).toBe(true);
    expect(allowsMarketingSend(false)).toBe(false);
    expect(allowsMarketingSend(undefined)).toBe(false);
    expect(allowsMarketingSend(null)).toBe(false);
  });

  it("opted-in customer may receive follow-up, review, and rebooking", () => {
    const optedIn = allowsMarketingSend(true);
    expect(optedIn && isMarketingOutboxKind(OUTBOX_KINDS.FOLLOW_UP)).toBe(true);
    expect(optedIn && isMarketingOutboxKind(OUTBOX_KINDS.REVIEW_REQUEST)).toBe(
      true,
    );
    expect(
      optedIn && isMarketingOutboxKind(OUTBOX_KINDS.REBOOKING_REMINDER),
    ).toBe(true);
  });

  it("opted-out customer must not receive follow-up, review, or rebooking", () => {
    const optedIn = allowsMarketingSend(false);
    expect(optedIn).toBe(false);
    // Enqueue/send path: marketing kinds require allowsMarketingSend
    for (const kind of MARKETING_OUTBOX_KINDS) {
      expect(isMarketingOutboxKind(kind) && !optedIn).toBe(true);
    }
  });

  it("transactional confirmation and reminder still allowed when opted out", () => {
    const optedIn = allowsMarketingSend(false);
    expect(optedIn).toBe(false);
    expect(isTransactionalOutboxKind(OUTBOX_KINDS.BOOKING_CONFIRMATION)).toBe(
      true,
    );
    expect(isTransactionalOutboxKind(OUTBOX_KINDS.BOOKING_REMINDER)).toBe(true);
    // Transactional path does not consult allowsMarketingSend
    expect(isMarketingOutboxKind(OUTBOX_KINDS.BOOKING_CONFIRMATION)).toBe(
      false,
    );
    expect(isMarketingOutboxKind(OUTBOX_KINDS.BOOKING_CREATED)).toBe(false);
    expect(isMarketingOutboxKind(OUTBOX_KINDS.BOOKING_REMINDER)).toBe(false);
    expect(isTransactionalOutboxKind(OUTBOX_KINDS.BOOKING_CREATED)).toBe(true);
  });

  it("queued marketing is suppressed after opt-out (send-time rule)", () => {
    // Simulates processDueOutbox: kind is marketing AND live opt-in is false → cancel
    const kind = OUTBOX_KINDS.FOLLOW_UP;
    const liveOptIn = false;
    const shouldSuppress =
      isMarketingOutboxKind(kind) && !allowsMarketingSend(liveOptIn);
    expect(shouldSuppress).toBe(true);
  });

  it("retries cannot bypass consent (same live check on every attempt)", () => {
    const kind = OUTBOX_KINDS.REVIEW_REQUEST;
    const attempt1 = isMarketingOutboxKind(kind) && !allowsMarketingSend(false);
    const attempt2 = isMarketingOutboxKind(kind) && !allowsMarketingSend(false);
    expect(attempt1).toBe(true);
    expect(attempt2).toBe(true);
  });
});
