import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  planAllowsReminders,
  planAllowsSms,
} from "@/server/billing/entitlements";
import {
  sendBookingReminder,
  type BookingEmailInput,
} from "@/server/notifications/email";
import {
  normalizePhone,
  sendBookingReminderSms,
  type BookingSmsInput,
} from "@/server/notifications/sms";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/observability";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

export async function enqueueBookingReminder(input: {
  organizationId: string;
  bookingId: string;
  startAt: Date;
  reminderHoursBefore: number;
  plan: Parameters<typeof planAllowsReminders>[0];
  organizationName: string;
  clientName: string;
  serviceName: string;
  resourceName: string;
  timezone: string;
  email?: string | null;
  phone?: string | null;
}) {
  const scheduledFor = new Date(
    input.startAt.getTime() - input.reminderHoursBefore * 60 * 60 * 1000,
  );
  if (scheduledFor.getTime() <= Date.now()) return;

  const base = {
    organizationName: input.organizationName,
    clientName: input.clientName,
    serviceName: input.serviceName,
    resourceName: input.resourceName,
    startAt: input.startAt,
    timezone: input.timezone,
    bookingId: input.bookingId,
  };

  const rows: Prisma.NotificationOutboxCreateManyInput[] = [];

  if (planAllowsReminders(input.plan) && input.email) {
    const emailPayload: BookingEmailInput = { ...base, to: input.email };
    rows.push({
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      channel: "EMAIL",
      kind: "BOOKING_REMINDER",
      toAddress: input.email,
      scheduledFor,
      payload: emailPayload as unknown as Prisma.InputJsonValue,
    });
  }

  const phone = normalizePhone(input.phone);
  if (planAllowsSms(input.plan) && phone) {
    const smsPayload: BookingSmsInput = { ...base, to: phone };
    rows.push({
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      channel: "SMS",
      kind: "BOOKING_REMINDER",
      toAddress: phone,
      scheduledFor,
      payload: smsPayload as unknown as Prisma.InputJsonValue,
    });
  }

  if (rows.length === 0) return;
  await db.notificationOutbox.createMany({ data: rows });
}

export async function cancelRemindersForBooking(bookingId: string) {
  await db.notificationOutbox.updateMany({
    where: {
      bookingId,
      kind: "BOOKING_REMINDER",
      status: { in: ["PENDING", "PROCESSING"] },
    },
    data: { status: "CANCELLED" },
  });
}

async function reclaimStaleProcessing() {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  await db.notificationOutbox.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: cutoff },
    },
    data: { status: "PENDING" },
  });
}

export async function processDueOutbox(limit = 50) {
  await reclaimStaleProcessing();

  const now = new Date();
  const due = await db.notificationOutbox.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of due) {
    const claimed = await db.notificationOutbox.updateMany({
      where: { id: item.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      let skipped = false;
      if (item.kind === "BOOKING_REMINDER" && item.channel === "EMAIL") {
        const payload = item.payload as unknown as BookingEmailInput;
        const result = await sendBookingReminder(payload);
        skipped = Boolean(result.skipped);
      } else if (item.kind === "BOOKING_REMINDER" && item.channel === "SMS") {
        const payload = item.payload as unknown as BookingSmsInput;
        const result = await sendBookingReminderSms(payload);
        skipped = Boolean(result.skipped);
      } else {
        throw new Error(
          `Unsupported outbox kind: ${item.kind}/${item.channel}`,
        );
      }

      if (skipped) {
        await db.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            lastError: "Provider not configured — message was not delivered",
          },
        });
        failed += 1;
        continue;
      }

      await db.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureException(error, { outboxId: item.id, kind: item.kind });
      logger.error({ err: error, outboxId: item.id }, "Outbox send failed");
      await db.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: item.attempts + 1 >= 5 ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          scheduledFor:
            item.attempts + 1 >= 5
              ? item.scheduledFor
              : new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      failed += 1;
    }
  }

  return { processed: due.length, sent, failed };
}
