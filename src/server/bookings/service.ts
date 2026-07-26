import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import type {
  BookingSource,
  BookingStatus,
  Prisma,
} from "@/generated/prisma/client";
import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import {
  sendBookingCancellation,
  sendBookingConfirmation,
} from "@/server/notifications/email";
import {
  cancelRemindersForBooking,
  enqueueBookingReminder,
} from "@/server/notifications/outbox";
import { getPlanLimits } from "@/server/billing/plans";
import { writeAuditLog } from "@/server/billing/entitlements";

const ACTIVE: BookingStatus[] = ["PENDING", "CONFIRMED"];

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

function hashLockKey(resourceId: string): number {
  let h = 0;
  for (let i = 0; i < resourceId.length; i++) {
    h = (h * 31 + resourceId.charCodeAt(i)) | 0;
  }
  return h;
}

async function assertBookingQuota(organizationId: string) {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const limits = getPlanLimits(org.plan);
  if (limits.bookingsPerMonth == null) return;

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const count = await db.booking.count({
    where: {
      organizationId,
      createdAt: { gte: start },
      status: { not: "CANCELLED" },
    },
  });

  if (count >= limits.bookingsPerMonth) {
    throw new Error(
      `Monthly booking limit reached for ${org.plan} plan (${limits.bookingsPerMonth})`,
    );
  }
}

export async function createBooking(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
  startAt: Date;
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  };
  source: BookingSource;
  idempotencyKey?: string | null;
  actorId?: string | null;
}): Promise<ActionResult<{ bookingId: string }>> {
  try {
    if (input.idempotencyKey) {
      const existing = await db.booking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return ok({ bookingId: existing.id });
      }
    }

    await assertBookingQuota(input.organizationId);

    const org = await db.organization.findUniqueOrThrow({
      where: { id: input.organizationId },
    });
    if (input.source === "PUBLIC" && !org.publicBookingEnabled) {
      return err("Online booking is currently disabled");
    }

    const service = await db.service.findFirst({
      where: {
        id: input.serviceId,
        organizationId: input.organizationId,
        isActive: true,
      },
    });
    if (!service) return err("Service not found");

    const resource = await db.resource.findFirst({
      where: {
        id: input.resourceId,
        organizationId: input.organizationId,
        isActive: true,
      },
      include: { location: true },
    });
    if (!resource) return err("Resource not found");

    const link = await db.serviceResource.findUnique({
      where: {
        serviceId_resourceId: {
          serviceId: input.serviceId,
          resourceId: input.resourceId,
        },
      },
    });
    if (!link && input.source === "PUBLIC") {
      return err("This staff member does not offer that service");
    }

    const endAt = new Date(
      input.startAt.getTime() + service.durationMin * 60_000,
    );

    const day = formatInTimeZone(
      input.startAt,
      resource.location.timezone,
      "yyyy-MM-dd",
    );
    const slots = await getSlotsForServiceResource({
      organizationId: input.organizationId,
      serviceId: input.serviceId,
      resourceId: input.resourceId,
      fromDate: day,
      toDate: day,
    });
    const stillOpen = slots.some(
      (s) => s.start.getTime() === input.startAt.getTime(),
    );
    if (!stillOpen) {
      return err("That time is no longer available");
    }

    const booking = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashLockKey(input.resourceId)})`;

      const overlap = await tx.booking.findFirst({
        where: {
          resourceId: input.resourceId,
          status: { in: ACTIVE },
          startAt: { lt: endAt },
          endAt: { gt: input.startAt },
        },
      });
      if (overlap) {
        throw new Error("SLOT_TAKEN");
      }

      let client = input.client.email
        ? await tx.client.findFirst({
            where: {
              organizationId: input.organizationId,
              email: input.client.email,
            },
          })
        : null;

      if (!client) {
        client = await tx.client.create({
          data: {
            organizationId: input.organizationId,
            name: input.client.name.trim(),
            email: input.client.email?.trim() || null,
            phone: input.client.phone?.trim() || null,
            notes: input.client.notes?.trim() || null,
          },
        });
      } else {
        client = await tx.client.update({
          where: { id: client.id },
          data: {
            name: input.client.name.trim(),
            phone: input.client.phone?.trim() || client.phone,
          },
        });
      }

      const created = await tx.booking.create({
        data: {
          organizationId: input.organizationId,
          locationId: resource.locationId,
          resourceId: input.resourceId,
          serviceId: input.serviceId,
          clientId: client.id,
          startAt: input.startAt,
          endAt,
          status: "CONFIRMED",
          source: input.source,
          notes: input.client.notes?.trim() || null,
          idempotencyKey: input.idempotencyKey || null,
          events: {
            create: {
              type: "CREATED",
              actorId: input.actorId ?? null,
              payload: { source: input.source } as Prisma.InputJsonValue,
            },
          },
        },
        include: {
          service: true,
          resource: true,
          client: true,
          location: true,
          organization: true,
        },
      });

      return created;
    });

    const emailPayload = booking.client.email
      ? {
          to: booking.client.email,
          organizationName: booking.organization.name,
          clientName: booking.client.name,
          serviceName: booking.service.name,
          resourceName: booking.resource.name,
          startAt: booking.startAt,
          timezone: booking.location.timezone,
          bookingId: booking.id,
        }
      : null;

    if (emailPayload) {
      try {
        await sendBookingConfirmation(emailPayload);
      } catch (e) {
        logger.error(
          { err: e, bookingId: booking.id },
          "Confirmation email failed",
        );
      }

      try {
        await enqueueBookingReminder({
          organizationId: booking.organizationId,
          bookingId: booking.id,
          startAt: booking.startAt,
          reminderHoursBefore: booking.organization.reminderHoursBefore,
          plan: booking.organization.plan,
          emailPayload,
        });
      } catch (e) {
        logger.error(
          { err: e, bookingId: booking.id },
          "Failed to enqueue reminder",
        );
      }
    }

    return ok({ bookingId: booking.id });
  } catch (e) {
    if (e instanceof Error && e.message === "SLOT_TAKEN") {
      return err("That time was just booked — pick another slot");
    }
    logger.error({ err: e }, "createBooking failed");
    return err(e instanceof Error ? e.message : "Unable to create booking");
  }
}

export async function transitionBooking(input: {
  organizationId: string;
  bookingId: string;
  to: BookingStatus;
  actorId?: string | null;
  cancelReason?: string | null;
}): Promise<ActionResult> {
  try {
    const booking = await db.booking.findFirst({
      where: {
        id: input.bookingId,
        organizationId: input.organizationId,
      },
      include: {
        service: true,
        resource: true,
        client: true,
        location: true,
        organization: true,
      },
    });

    if (!booking) return err("Booking not found");

    const allowed = TRANSITIONS[booking.status];
    if (!allowed.includes(input.to)) {
      return err(`Cannot move from ${booking.status} to ${input.to}`);
    }

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: input.to,
          cancelReason:
            input.to === "CANCELLED"
              ? (input.cancelReason ?? "Cancelled")
              : booking.cancelReason,
        },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: `STATUS_${input.to}`,
          actorId: input.actorId ?? null,
          payload: { from: booking.status, to: input.to },
        },
      });
    });

    if (input.to === "CANCELLED") {
      await cancelRemindersForBooking(booking.id);
      if (booking.client.email) {
        try {
          await sendBookingCancellation({
            to: booking.client.email,
            organizationName: booking.organization.name,
            clientName: booking.client.name,
            serviceName: booking.service.name,
            resourceName: booking.resource.name,
            startAt: booking.startAt,
            timezone: booking.location.timezone,
            bookingId: booking.id,
          });
        } catch (e) {
          logger.error(
            { err: e, bookingId: booking.id },
            "Cancellation email failed",
          );
        }
      }
    }

    try {
      await writeAuditLog({
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: `booking.${input.to.toLowerCase()}`,
        entityType: "booking",
        entityId: booking.id,
        metadata: { from: booking.status, to: input.to },
      });
    } catch (e) {
      logger.error({ err: e }, "Audit log write failed");
    }

    return okEmpty();
  } catch (e) {
    return err(e instanceof Error ? e.message : "Unable to update booking");
  }
}
