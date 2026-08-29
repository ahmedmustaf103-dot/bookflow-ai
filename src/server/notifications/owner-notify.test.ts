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
  sendStaffBookingRescheduleEmail: vi.fn(),
  sendStaffBookingCancellationEmail: vi.fn(),
}));

vi.mock("@/server/notifications/sms", () => ({
  normalizePhone: (v: string | null | undefined) => v ?? null,
  sendBookingReminderSms: vi.fn().mockResolvedValue({ skipped: false }),
}));

const { create, membershipFindMany, resourceFindFirst, bookingEventCount } =
  vi.hoisted(() => ({
    create: vi.fn(),
    membershipFindMany: vi.fn(),
    resourceFindFirst: vi.fn(),
    bookingEventCount: vi.fn(),
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
    resource: {
      findFirst: resourceFindFirst,
    },
    booking: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    bookingEvent: {
      count: bookingEventCount,
    },
  },
}));

import { Prisma } from "@/generated/prisma/client";
import {
  enqueueBookingCancellation,
  enqueueBookingReschedule,
  enqueueOwnerNewBooking,
} from "@/server/notifications/outbox";
import {
  OUTBOX_KINDS,
  ownerNotifyDedupeKey,
  staffCancelDedupeKey,
  staffRescheduleDedupeKey,
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
    resourceFindFirst.mockResolvedValue(null);
    bookingEventCount.mockResolvedValue(0);
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

  it("includes the assigned staff member without duplicating the owner", async () => {
    membershipFindMany.mockResolvedValue([
      { user: { email: "owner@shop.test" } },
    ]);
    resourceFindFirst.mockResolvedValue({
      user: { email: "barber-a@shop.test" },
    });

    await enqueueOwnerNewBooking({ ...ctx, resourceId: "chair-a" });

    expect(resourceFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "chair-a",
          organizationId: "org1",
        }),
      }),
    );
    const addresses = create.mock.calls.map(
      (call) =>
        (call[0] as { data: { toAddress: string; kind: string } }).data
          .toAddress,
    );
    expect(addresses.sort()).toEqual(["barber-a@shop.test", "owner@shop.test"]);
    expect(
      create.mock.calls.every(
        (call) =>
          (call[0] as { data: { kind: string } }).data.kind ===
          OUTBOX_KINDS.BOOKING_CREATED,
      ),
    ).toBe(true);
  });

  it("sends one shop email when the assigned staff is also the owner", async () => {
    membershipFindMany.mockResolvedValue([
      { user: { email: "owner@shop.test" } },
    ]);
    resourceFindFirst.mockResolvedValue({
      user: { email: "Owner@Shop.test" },
    });

    await enqueueOwnerNewBooking({ ...ctx, resourceId: "chair-owner" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(
      (create.mock.calls[0]?.[0] as { data: { toAddress: string } }).data
        .toAddress,
    ).toBe("owner@shop.test");
  });
});

describe("assigned staff reschedule and cancel", () => {
  const staffCtx: BookingNotifyContext = { ...ctx, resourceId: "chair-a" };

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({});
    resourceFindFirst.mockResolvedValue({
      user: { email: "barber-a@shop.test" },
    });
    bookingEventCount.mockResolvedValue(1);
  });

  it("emails the assigned staff the new time on reschedule", async () => {
    await enqueueBookingReschedule(staffCtx);
    const rows = create.mock.calls.map(
      (call) =>
        (
          call[0] as {
            data: {
              kind: string;
              toAddress: string;
              dedupeKey: string;
              payload: { startAt: Date; to: string };
            };
          }
        ).data,
    );
    expect(rows.map((r) => r.kind).sort()).toEqual([
      OUTBOX_KINDS.BOOKING_RESCHEDULED,
      OUTBOX_KINDS.STAFF_BOOKING_RESCHEDULED,
    ]);
    const staffRow = rows.find(
      (r) => r.kind === OUTBOX_KINDS.STAFF_BOOKING_RESCHEDULED,
    );
    expect(staffRow?.toAddress).toBe("barber-a@shop.test");
    expect(staffRow?.dedupeKey).toBe(
      staffRescheduleDedupeKey("b1", "barber-a@shop.test", staffCtx.startAt),
    );
    expect(new Date(staffRow!.payload.startAt).toISOString()).toBe(
      staffCtx.startAt.toISOString(),
    );
    expect(staffRow?.payload.to).not.toBe(ctx.clientEmail);
  });

  it("emails the assigned staff on cancellation", async () => {
    await enqueueBookingCancellation(staffCtx);
    const rows = create.mock.calls.map(
      (call) =>
        (call[0] as { data: { kind: string; toAddress: string } }).data,
    );
    expect(rows.map((r) => r.kind).sort()).toEqual([
      OUTBOX_KINDS.BOOKING_CANCELLATION,
      OUTBOX_KINDS.STAFF_BOOKING_CANCELLED,
    ]);
    const staffRow = rows.find(
      (r) => r.kind === OUTBOX_KINDS.STAFF_BOOKING_CANCELLED,
    );
    expect(staffRow?.toAddress).toBe("barber-a@shop.test");
    expect(
      (
        create.mock.calls.find(
          (call) =>
            (call[0] as { data: { kind: string } }).data.kind ===
            OUTBOX_KINDS.STAFF_BOOKING_CANCELLED,
        )?.[0] as { data: { dedupeKey: string } }
      ).data.dedupeKey,
    ).toBe(staffCancelDedupeKey("b1", "barber-a@shop.test"));
  });

  it("does not send a second staff copy to the customer address", async () => {
    resourceFindFirst.mockResolvedValue({
      user: { email: ctx.clientEmail },
    });
    await enqueueBookingReschedule(staffCtx);
    const kinds = create.mock.calls.map(
      (call) => (call[0] as { data: { kind: string } }).data.kind,
    );
    expect(kinds).toEqual([OUTBOX_KINDS.BOOKING_RESCHEDULED]);
  });
});
