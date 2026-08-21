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

vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_key",
    RESEND_FROM_EMAIL: "BookFlow AI <onboarding@resend.dev>",
  },
}));

const { sendMock, findMany, updateMany, update } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    emails = { send: sendMock };
  },
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
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
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
  MAX_ATTEMPTS,
  nextRetryAt,
  processDueOutbox,
} from "@/server/notifications/outbox";
import { OUTBOX_KINDS } from "@/server/notifications/kinds";

const RESEND_API_ERROR =
  "The bookflowai.com domain is not verified. Please, add and verify your domain.";

function confirmationItem(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-08-10T12:00:00.000Z");
  return {
    id: "o1",
    kind: OUTBOX_KINDS.BOOKING_CONFIRMATION,
    channel: "EMAIL" as const,
    attempts: 0,
    scheduledFor: now,
    organizationId: "org1",
    bookingId: "b1",
    payload: {
      to: "client@example.com",
      organizationName: "Shop",
      clientName: "Alex",
      serviceName: "Cut",
      resourceName: "Sam",
      startAt: now.toISOString(),
      endAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      timezone: "UTC",
      bookingId: "b1",
      manageUrl: "https://x/book/manage/t",
      calendarIcsUrl: "https://x/book/manage/t/calendar",
      bookUrl: "https://x/book/shop",
    },
    ...overrides,
  };
}

describe("Resend { error } without throw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 0 });
    update.mockResolvedValue({});
    findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retries the outbox item and preserves lastError when send returns { error }", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([confirmationItem()]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "application_error", message: RESEND_API_ERROR },
    });

    const result = await processDueOutbox(50, now);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        status: "PENDING",
        lastError: RESEND_API_ERROR,
        scheduledFor: nextRetryAt(OUTBOX_KINDS.BOOKING_CONFIRMATION, now),
      },
    });
  });

  it("marks FAILED after max attempts and keeps the Resend error", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      confirmationItem({ attempts: MAX_ATTEMPTS - 1 }),
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({
      data: null,
      error: { message: RESEND_API_ERROR },
    });

    await processDueOutbox(50, now);

    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        status: "FAILED",
        lastError: RESEND_API_ERROR,
        scheduledFor: now,
      },
    });
  });

  it("does not mark SENT when Resend returns no email id", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([confirmationItem()]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({ data: {}, error: null });

    const result = await processDueOutbox(50, now);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({
        status: "PENDING",
        lastError: "Resend send returned no email id",
      }),
    });
  });

  it("lowercases the recipient so Resend test-mode allowlist matches", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      confirmationItem({
        payload: {
          to: "Ahmedmustaf103@gmail.com",
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
      }),
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const result = await processDueOutbox(50, now);

    expect(result.sent).toBe(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ahmedmustaf103@gmail.com" }),
    );
  });

  it("marks SENT when Resend returns an email id and no error", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([confirmationItem()]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const result = await processDueOutbox(50, now);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: expect.objectContaining({ status: "SENT", lastError: null }),
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: "appointment.ics",
            content: expect.any(Buffer),
          }),
        ],
      }),
    );
  });

  it("retries BOOKING_CREATED with the same Resend { error } outbox behaviour", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    findMany.mockResolvedValue([
      confirmationItem({
        id: "o-owner",
        kind: OUTBOX_KINDS.BOOKING_CREATED,
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
      }),
    ]);
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "application_error", message: RESEND_API_ERROR },
    });

    const result = await processDueOutbox(50, now);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@shop.test",
        subject: expect.stringContaining("New booking"),
      }),
    );
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "o-owner" },
      data: {
        status: "PENDING",
        lastError: RESEND_API_ERROR,
        scheduledFor: nextRetryAt(OUTBOX_KINDS.BOOKING_CREATED, now),
      },
    });
  });
});
