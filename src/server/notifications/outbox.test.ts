import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/booking-urls", () => ({
  bookingManageUrl: () => "https://app.test/book/manage/t",
  publicBookingUrl: () => "https://app.test/book/shop",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const {
  findMany,
  updateMany,
  update,
  sendConfirmation,
  sendCancellation,
  sendReminder,
  sendReschedule,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  sendConfirmation: vi.fn(),
  sendCancellation: vi.fn(),
  sendReminder: vi.fn(),
  sendReschedule: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    notificationOutbox: {
      findMany,
      updateMany,
      update,
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/notifications/email", () => ({
  sendBookingConfirmation: sendConfirmation,
  sendBookingCancellation: sendCancellation,
  sendBookingReminder: sendReminder,
  sendBookingReschedule: sendReschedule,
  sendFollowUpEmail: vi.fn(),
  sendReviewRequestEmail: vi.fn(),
  sendRebookingReminderEmail: vi.fn(),
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
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_CANCELLATION)).toBe(true);
    expect(isImmediateOutboxKind(OUTBOX_KINDS.BOOKING_RESCHEDULED)).toBe(true);
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
    expect(nextRetryAt(OUTBOX_KINDS.BOOKING_CONFIRMATION, now).toISOString()).toBe(
      new Date(now.getTime() + IMMEDIATE_RETRY_DELAY_MS).toISOString(),
    );
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
});
