import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/observability", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (fn: () => void) => {
    void fn();
  },
}));

vi.mock("@/server/notifications/email", () => ({
  sendBookingConfirmation: vi.fn(),
  sendBookingCancellation: vi.fn(),
  sendBookingReminder: vi.fn(),
  sendBookingReschedule: vi.fn(),
  sendFollowUpEmail: vi.fn(),
  sendReviewRequestEmail: vi.fn(),
  sendRebookingReminderEmail: vi.fn(),
  sendOwnerNewBookingEmail: vi.fn(),
}));

vi.mock("@/server/notifications/sms", () => ({
  normalizePhone: (v: string | null | undefined) => v ?? null,
  sendBookingReminderSms: vi.fn().mockResolvedValue({ skipped: false }),
}));

const { create, membershipFindMany } = vi.hoisted(() => ({
  create: vi.fn(),
  membershipFindMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    notificationOutbox: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create,
    },
    membership: {
      findMany: membershipFindMany,
    },
    booking: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { Prisma } from "@/generated/prisma/client";
import { enqueueOwnerNewBooking } from "@/server/notifications/outbox";
import {
  OUTBOX_KINDS,
  ownerNotifyDedupeKey,
} from "@/server/notifications/kinds";
import type { BookingNotifyContext } from "@/server/notifications/outbox";

const ctx: BookingNotifyContext = {
  organizationId: "org1",
  organizationName: "Shop",
  organizationSlug: "shop",
  plan: "STARTER",
  bookingId: "b1",
  manageToken: "tok",
  startAt: new Date("2026-08-18T12:00:00.000Z"),
  endAt: new Date("2026-08-18T12:30:00.000Z"),
  timezone: "Europe/London",
  clientName: "Jordan Client",
  clientEmail: "jordan@client.test",
  marketingOptIn: false,
  serviceName: "Haircut",
  resourceName: "Alex Rivera",
  priceCents: 3500,
  currency: "GBP",
};

describe("enqueueOwnerNewBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({});
  });

  it("enqueues BOOKING_CREATED to OWNER/ADMIN emails, not the customer", async () => {
    membershipFindMany.mockResolvedValue([
      { user: { email: "Owner@Shop.test" } },
      { user: { email: "admin@shop.test" } },
    ]);

    await enqueueOwnerNewBooking(ctx);

    expect(membershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org1",
          status: "ACTIVE",
          role: { in: ["OWNER", "ADMIN"] },
        }),
      }),
    );
    expect(create).toHaveBeenCalledTimes(2);
    const rows = create.mock.calls.map(
      (call) =>
        (
          call[0] as {
            data: {
              toAddress: string;
              kind: string;
              dedupeKey: string;
              payload: { to: string };
            };
          }
        ).data,
    );
    expect(rows.every((r) => r.kind === OUTBOX_KINDS.BOOKING_CREATED)).toBe(
      true,
    );
    expect(rows.map((r) => r.toAddress).sort()).toEqual([
      "admin@shop.test",
      "owner@shop.test",
    ]);
    expect(rows.every((r) => r.toAddress !== ctx.clientEmail)).toBe(true);
    expect(rows.every((r) => r.payload.to !== ctx.clientEmail)).toBe(true);
    expect(rows[0]?.dedupeKey).toBe(
      ownerNotifyDedupeKey("b1", rows[0]!.toAddress),
    );
  });

  it("does not enqueue when no owner/admin email exists", async () => {
    membershipFindMany.mockResolvedValue([
      { user: { email: null } },
      { user: { email: "  " } },
    ]);
    await enqueueOwnerNewBooking(ctx);
    expect(create).not.toHaveBeenCalled();
  });

  it("swallows duplicate dedupe keys so retries do not double-notify", async () => {
    membershipFindMany.mockResolvedValue([
      { user: { email: "owner@shop.test" } },
    ]);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(enqueueOwnerNewBooking(ctx)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
