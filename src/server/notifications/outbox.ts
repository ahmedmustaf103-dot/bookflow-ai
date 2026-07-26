import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { planAllowsReminders } from "@/server/billing/entitlements";
import {
  sendBookingReminder,
  type BookingEmailInput,
} from "@/server/notifications/email";
import { logger } from "@/lib/logger";

export async function enqueueBookingReminder(input: {
  organizationId: string;
  bookingId: string;
  startAt: Date;
  reminderHoursBefore: number;
  plan: Parameters<typeof planAllowsReminders>[0];
  emailPayload: BookingEmailInput & { to: string };
}) {
  if (!planAllowsReminders(input.plan)) {
    return;
  }
  if (!input.emailPayload.to) return;

  const scheduledFor = new Date(
    input.startAt.getTime() - input.reminderHoursBefore * 60 * 60 * 1000,
  );

  // Don't enqueue if already in the past (or too soon) — skip silently
  if (scheduledFor.getTime() <= Date.now()) {
    return;
  }

  await db.notificationOutbox.create({
    data: {
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      channel: "EMAIL",
      kind: "BOOKING_REMINDER",
      toAddress: input.emailPayload.to,
      scheduledFor,
      payload: input.emailPayload as unknown as Prisma.InputJsonValue,
    },
  });
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

export async function processDueOutbox(limit = 50) {
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
      if (item.kind === "BOOKING_REMINDER" && item.channel === "EMAIL") {
        const payload = item.payload as unknown as BookingEmailInput;
        await sendBookingReminder(payload);
      } else {
        throw new Error(`Unsupported outbox kind: ${item.kind}`);
      }

      await db.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error({ err: error, outboxId: item.id }, "Outbox send failed");
      await db.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: item.attempts + 1 >= 5 ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          // retry in 15 minutes
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
