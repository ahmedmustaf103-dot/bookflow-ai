import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/booking-urls", () => ({
  bookingManageUrl: () => "https://app.test/book/manage/t",
  bookingCalendarIcsUrl: () => "https://app.test/book/manage/t/calendar",
  publicBookingUrl: () => "https://app.test/book/shop",
  dashboardAppointmentsUrl: () => "https://app.test/dashboard/appointments",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const {
  findMany,
  updateMany,
  update,
  bookingFindFirst,
  sendConfirmation,
  sendCancellation,
  sendReminder,
  sendReschedule,
  sendFollowUp,
  sendReview,
  sendRebooking,
  sendOwnerNew,
  sendStaffReschedule,
  sendStaffCancel,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  bookingFindFirst: vi.fn(),
  sendConfirmation: vi.fn(),
  sendCancellation: vi.fn(),
  sendReminder: vi.fn(),
  sendReschedule: vi.fn(),
  sendFollowUp: vi.fn(),
  sendReview: vi.fn(),
  sendRebooking: vi.fn(),
  sendOwnerNew: vi.fn(),
  sendStaffReschedule: vi.fn(),
  sendStaffCancel: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    notificationOutbox: {
      findMany,
      updateMany,
      update,
      create: vi.fn(),
    },
    booking: {
      findFirst: bookingFindFirst,
      findMany: vi.fn(),
    },
    bookingEvent: {
      count: vi.fn().mockResolvedValue(0),
    },
    resource: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/server/notifications/email", () => ({
  sendBookingConfirmation: sendConfirmation,
  sendBookingCancellation: sendCancellation,
  sendBookingReminder: sendReminder,
  sendBookingReschedule: sendReschedule,
  sendFollowUpEmail: sendFollowUp,
  sendReviewRequestEmail: sendReview,
  sendRebookingReminderEmail: sendRebooking,
  sendOwnerNewBookingEmail: sendOwnerNew,
  sendStaffBookingRescheduleEmail: sendStaffReschedule,
  sendStaffBookingCancellationEmail: sendStaffCancel,
}));

vi.mock("@/server/notifications/sms", () => ({
  normalizePhone: (v: string | null | undefined) => v ?? null,
  sendBookingReminderSms: vi.fn().mockResolvedValue({ skipped: false }),
}));

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    void fn();
  },
}));

import {
  IMMEDIATE_RETRY_DELAY_MS,
  MAX_ATTEMPTS,
  STANDARD_RETRY_DELAY_MS,
  STALE_PROCESSING_MS,
  isImmediateOutboxKind,
  isStaleProcessing,
  nextRetryAt,
  processDueOutbox,
  retryDelayMsForKind,
} from "@/server/notifications/outbox";
import { OUTBOX_KINDS } from "@/server/notifications/kinds";

describe("outbox timing helpers", () => {
  it("treats confirmation/cancellation/reschedule as immediate", () => {
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_CONFIRMATION)).toBe(true);
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_CREATED)).toBe(true);
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_CANCELLATION)).toBe(true);
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_RESCHEDULED)).toBe(true);
    expect(isImmediateOutboxKind(OUTBOX_KINDS.STAFF_BOOKING_RESCHEDULED)).toBe(
      true,
    );
    expect(isImmediateOutboxKind(OUTBOX_KINDS.STAFF_BOOKING_CANCELLED)).toBe(
      true,
    );
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_REMINDER)).toBe(false);
  });

  it("uses shorter retry backoff for immediate kinds", () => {
    expect(retryDelayMsForKind(OUTBOX_KINDS.BOOKING_CONFIRMATION)).toBe(
      IMMEDIATE_RETRY_DELAY_MS,
    );
    expect(retryDelayMsForKind(OUTBOX_KINDS.BOOKING_REMINDER)).toBe(
      STANDARD_RETRY_DELAY_MS,
    );
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(
      nextRetryAt(OUTBOX_KINDS.BOOKING_CONFIRMATION, now).toISOString(),
    ).toBe(new Date(now.getTime() + IMMEDIATE_RETRY_DELAY_MS).toISOString());
  });

  it("detects stale PROCESSING rows", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const fresh = new Date(now.getTime() - 60_000);
    const stale = new Date(now.getTime() - STALE_PROCESSING_MS - 1);
    expect(isStaleProcessing(fresh, now)).toBe(false);
    expect(isStaleProcessing(stale, now)).toBe(true);
  });
});

describe("processDueOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 0 });
    update.mockResolvedValue({});
    findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("only selects PENDING rows with scheduledFor <= now", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([]);
    await processDueOutbox(10, now);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PENDING",
          scheduledFor: { lte: now },
        },
        take: 10,
      }),
    );
  });

  it("reclaims stale PROCESSING before selecting due work", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    updateMany
      .mockResolvedValueOnce({ count: 2 }) // reclaim
      .mockResolvedValue({ count: 0 });
    findMany.mockResolvedValue([]);
    const result = await processDueOutbox(5, now);
    expect(result.reclaimed).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PROCESSING",
          updatedAt: { lt: new Date(now.getTime() - STALE_PROCESSING_MS) },
        },
        data: { status: "PENDING" },
      }),
    );
  });

  it("sends a due confirmation and marks SENT", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const item = {
      id: "o1",
      kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
      channel: "EMAIL" as const,
      attempts: 0,
      scheduledFor: now,
      payload: {
        to: "a@b.com",
        organizationName: "Shop",
        clientName: "Alex",
        serviceName: "Cut",
        resourceName: "Sam",
        startAt: now.toISOString(),
        timezone: "UTC",
        bookingId: "b1",
        manageUrl: "https://x/book/manage/t",
        bookUrl: "https://x/book/shop",
      },
    };
    findMany.mockResolvedValue([item]);
    updateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValueOnce({ count: 1 }); // claim
    sendConfirmation.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({ status: "SENT", lastError: null }),
    });
    expect(result).toMatchObject({ sent: 1, failed: 0, skippedClaim: 0 });
  });

  it("skips duplicate claim (concurrent flush)", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_CANCELLATION,
        channel: "EMAIL",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 }); // lost claim race

    const result = await processDueOutbox(50, now);
    expect(sendCancellation).not.toHaveBeenCalled();
    expect(result.skippedClaim).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("retries failed sends with kind-aware backoff", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
        channel: "EMAIL",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendConfirmation.mockRejectedValue(new Error("Resend down"));

    const result = await processDueOutbox(50, now);
    expect(result.failed).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        status: "PENDING",
        lastError: "Resend down",
        scheduledFor: nextRetryAt(OUTBOX_KINDS.BOOKING_CONFIRMATION, now),
      },
    });
  });

  it("marks FAILED after max attempts", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_REMINDER,
        channel: "EMAIL",
        attempts: MAX_ATTEMPTS - 1,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendReminder.mockRejectedValue(new Error("boom"));

    await processDueOutbox(50, now);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        status: "FAILED",
        lastError: "boom",
        scheduledFor: now,
      },
    });
  });

  it("defers when provider is not configured (skipped)", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
        channel: "EMAIL",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendConfirmation.mockResolvedValue({ skipped: true });

    const result = await processDueOutbox(50, now);
    expect(result.deferred).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({
        status: "PENDING",
        lastError: "Provider not configured — will retry",
      }),
    });
  });

  it("dispatches reschedule emails", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_RESCHEDULED,
        channel: "EMAIL",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendReschedule.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(sendReschedule).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it("dispatches owner new-booking emails", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o-owner",
        kind: OUTBOX_KINDS.BOOKING_CREATED,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: {
          to: "owner@shop.test",
          organizationName: "Shop",
          clientName: "Alex",
          serviceName: "Cut",
          resourceName: "Sam",
          startAt: now.toISOString(),
          timezone: "UTC",
          bookingId: "b1",
          priceCents: 3500,
          currency: "GBP",
          dashboardUrl: "https://app.test/dashboard/appointments",
        },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendOwnerNew.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(sendOwnerNew).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });

  it("retries owner new-booking when Resend throws, then FAILED at max attempts", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o-owner",
        kind: OUTBOX_KINDS.BOOKING_CREATED,
        channel: "EMAIL",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendOwnerNew.mockRejectedValue(new Error("Resend down"));

    const result = await processDueOutbox(50, now);
    expect(result.failed).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o-owner" },
      data: {
        status: "PENDING",
        lastError: "Resend down",
        scheduledFor: nextRetryAt(OUTBOX_KINDS.BOOKING_CREATED, now),
      },
    });
  });

  it("still sends owner new-booking when marketingOptIn is false", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o-owner",
        kind: OUTBOX_KINDS.BOOKING_CREATED,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString(), to: "owner@shop.test" },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendOwnerNew.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(sendOwnerNew).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it("sends follow-up when client is opted in", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.FOLLOW_UP,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    bookingFindFirst.mockResolvedValue({
      client: { marketingOptIn: true },
    });
    sendFollowUp.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(sendFollowUp).toHaveBeenCalled();
    expect(result.sent).toBe(1);
    expect(result.suppressedMarketing).toBe(0);
  });

  it("cancels queued follow-up when client opted out (no retry)", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.FOLLOW_UP,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 1,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    bookingFindFirst.mockResolvedValue({
      client: { marketingOptIn: false },
    });

    const result = await processDueOutbox(50, now);
    expect(sendFollowUp).not.toHaveBeenCalled();
    expect(result.suppressedMarketing).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        status: "CANCELLED",
        lastError: "Cancelled: marketing opt-out",
      },
    });
  });

  it("cancels queued review and rebooking when opted out", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o-review",
        kind: OUTBOX_KINDS.REVIEW_REQUEST,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
      {
        id: "o-rebook",
        kind: OUTBOX_KINDS.REBOOKING_REMINDER,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 }) // reclaim
      .mockResolvedValue({ count: 1 }); // claims
    bookingFindFirst.mockResolvedValue({
      client: { marketingOptIn: false },
    });

    const result = await processDueOutbox(50, now);
    expect(sendReview).not.toHaveBeenCalled();
    expect(sendRebooking).not.toHaveBeenCalled();
    expect(result.suppressedMarketing).toBe(2);
  });

  it("still sends confirmation when marketingOptIn is false", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendConfirmation.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(sendConfirmation).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it("still sends reminder when marketingOptIn is false", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "o1",
        kind: OUTBOX_KINDS.BOOKING_REMINDER,
        channel: "EMAIL",
        organizationId: "org1",
        bookingId: "b1",
        attempts: 0,
        scheduledFor: now,
        payload: { startAt: now.toISOString() },
      },
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendReminder.mockResolvedValue({ skipped: false });

    const result = await processDueOutbox(50, now);
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(sendReminder).toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });
});
