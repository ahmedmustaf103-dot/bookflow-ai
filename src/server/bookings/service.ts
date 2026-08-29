import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import {
  Prisma,
  type BookingSource,
  type BookingStatus,
} from "@/generated/prisma/client";
import {
  toSafeActionError,
  UserFacingError,
} from "@/lib/action-errors";
import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import {
  cancelPendingAutomationForBooking,
  cancelRemindersForBooking,
  enqueueBookingCancellation,
  enqueueBookingConfirmation,
  enqueueBookingReminder,
  enqueueBookingReschedule,
  enqueueOwnerNewBooking,
  enqueuePostVisitAutomation,
  type BookingNotifyContext,
} from "@/server/notifications/outbox";
import { getPlanLimits } from "@/server/billing/plans";
import { writeAuditLog } from "@/server/billing/entitlements";
import { invalidateSlotsForResource } from "@/server/cache/slots";
import { captureException } from "@/lib/observability";
import { isBookingOverlapError } from "@/server/bookings/overlap";
import {
  pushGoogleCalendarCancel,
  pushGoogleCalendarUpsert,
} from "@/server/integrations/google-calendar";

const ACTIVE: BookingStatus[] = ["PENDING", "CONFIRMED"];

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

function notifyContext(booking: {
  id: string;
  organizationId: string;
  startAt: Date;
  endAt: Date;
  manageToken: string;
  organization: {
    name: string;
    slug: string;
    plan: BookingNotifyContext["plan"];
    reviewUrl?: string | null;
    logoUrl?: string | null;
    brandPrimary?: string | null;
    customDomain?: string | null;
    customDomainStatus?: string | null;
  };
  client: {
    name: string;
    email: string | null;
    phone: string | null;
    marketingOptIn?: boolean;
  };
  service: { name: string; priceCents?: number; currency?: string };
  resource: { name: string };
  resourceId: string;
  location: { timezone: string };
}): BookingNotifyContext {
  return {
    organizationId: booking.organizationId,
    organizationName: booking.organization.name,
    organizationSlug: booking.organization.slug,
    plan: booking.organization.plan,
    bookingId: booking.id,
    manageToken: booking.manageToken,
    startAt: booking.startAt,
    endAt: booking.endAt,
    timezone: booking.location.timezone,
    clientName: booking.client.name,
    clientEmail: booking.client.email,
    clientPhone: booking.client.phone,
    marketingOptIn: booking.client.marketingOptIn ?? false,
    serviceName: booking.service.name,
    resourceName: booking.resource.name,
    resourceId: booking.resourceId,
    priceCents: booking.service.priceCents ?? null,
    currency: booking.service.currency ?? null,
    reviewUrl: booking.organization.reviewUrl ?? null,
    logoUrl: booking.organization.logoUrl ?? null,
    brandPrimary: booking.organization.brandPrimary ?? null,
    customDomain: booking.organization.customDomain ?? null,
    customDomainStatus: booking.organization.customDomainStatus ?? null,
  };
}

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
    throw new UserFacingError(
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
    /** Engagement emails (follow-up / review / rebooking). Default false. */
    marketingOptIn?: boolean | null;
  };
  source: BookingSource;
  idempotencyKey?: string | null;
  actorId?: string | null;
}): Promise<ActionResult<{ bookingId: string; isFirstBooking?: boolean }>> {
  try {
    if (input.idempotencyKey) {
      const existing = await db.booking.findFirst({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) {
        return ok({ bookingId: existing.id, isFirstBooking: false });
      }
    }

    const priorCount = await db.booking.count({
      where: { organizationId: input.organizationId },
    });

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
    if (!link) {
      return err("This staff member does not offer that service");
    }

    const endAt = new Date(
      input.startAt.getTime() + service.durationMin * 60_000,
    );
    const paddedStart = new Date(
      input.startAt.getTime() - service.bufferBefore * 60_000,
    );
    const paddedEnd = new Date(
      endAt.getTime() + service.bufferAfter * 60_000,
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

      const candidates = await tx.booking.findMany({
        where: {
          resourceId: input.resourceId,
          status: { in: ACTIVE },
          startAt: { lt: paddedEnd },
          endAt: { gt: paddedStart },
        },
        include: {
          service: { select: { bufferBefore: true, bufferAfter: true } },
        },
      });

      for (const other of candidates) {
        const otherStart =
          other.startAt.getTime() - other.service.bufferBefore * 60_000;
        const otherEnd =
          other.endAt.getTime() + other.service.bufferAfter * 60_000;
        if (
          paddedStart.getTime() < otherEnd &&
          paddedEnd.getTime() > otherStart
        ) {
          throw new Error("SLOT_TAKEN");
        }
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
        try {
          client = await tx.client.create({
            data: {
              organizationId: input.organizationId,
              name: input.client.name.trim(),
              email: input.client.email?.trim() || null,
              phone: input.client.phone?.trim() || null,
              notes: input.client.notes?.trim() || null,
              marketingOptIn: Boolean(input.client.marketingOptIn),
            },
          });
        } catch (createErr) {
          if (
            createErr instanceof Prisma.PrismaClientKnownRequestError &&
            createErr.code === "P2002" &&
            input.client.email
          ) {
            client = await tx.client.findFirst({
              where: {
                organizationId: input.organizationId,
                email: input.client.email,
              },
            });
            if (!client) throw createErr;
          } else {
            throw createErr;
          }
        }
      } else if (input.source !== "PUBLIC") {
        // Staff/AI may refresh contact fields; public bookings must not overwrite PII.
        client = await tx.client.update({
          where: { id: client.id },
          data: {
            name: input.client.name.trim(),
            phone: input.client.phone?.trim() || client.phone,
            ...(input.client.marketingOptIn != null
              ? { marketingOptIn: Boolean(input.client.marketingOptIn) }
              : {}),
          },
        });
      } else if (input.client.marketingOptIn) {
        // Public flow may opt in only (never silently opt existing clients out).
        client = await tx.client.update({
          where: { id: client.id },
          data: { marketingOptIn: true },
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

    try {
      await invalidateSlotsForResource(input.resourceId);
    } catch (e) {
      logger.warn({ err: e }, "slot cache invalidate after create failed");
    }

    const ctx = notifyContext(booking);

    try {
      await enqueueOwnerNewBooking(ctx);
    } catch (e) {
      logger.error(
        { err: e, bookingId: booking.id },
        "Failed to enqueue owner new-booking email",
      );
    }

    try {
      await enqueueBookingConfirmation(ctx);
    } catch (e) {
      logger.error(
        { err: e, bookingId: booking.id },
        "Failed to enqueue confirmation email",
      );
    }

    try {
      await enqueueBookingReminder({
        organizationId: booking.organizationId,
        bookingId: booking.id,
        startAt: booking.startAt,
        reminderHoursBefore: booking.organization.reminderHoursBefore,
        plan: booking.organization.plan,
        organizationName: booking.organization.name,
        organizationSlug: booking.organization.slug,
        manageToken: booking.manageToken,
        clientName: booking.client.name,
        serviceName: booking.service.name,
        resourceName: booking.resource.name,
        timezone: booking.location.timezone,
        email: booking.client.email,
        phone: booking.client.phone,
        logoUrl: booking.organization.logoUrl,
        brandPrimary: booking.organization.brandPrimary,
        customDomain: booking.organization.customDomain,
        customDomainStatus: booking.organization.customDomainStatus,
        reviewUrl: booking.organization.reviewUrl,
      });
    } catch (e) {
      logger.error(
        { err: e, bookingId: booking.id },
        "Failed to enqueue reminder",
      );
    }

    void pushGoogleCalendarUpsert({
      organizationId: booking.organizationId,
      bookingId: booking.id,
      googleEventId: booking.googleEventId,
      summary: `${booking.service.name} · ${booking.client.name}`,
      description: `With ${booking.resource.name}`,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.location.timezone,
    });

    return ok({
      bookingId: booking.id,
      isFirstBooking: priorCount === 0,
    });
  } catch (e) {
    if (isBookingOverlapError(e)) {
      return err("That time was just booked — pick another slot");
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      input.idempotencyKey
    ) {
      const existing = await db.booking.findFirst({
        where: {
          organizationId: input.organizationId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing) return ok({ bookingId: existing.id });
    }
    if (e instanceof UserFacingError) {
      return err(e.message);
    }
    captureException(e, { action: "createBooking" });
    logger.error({ err: e }, "createBooking failed");
    return err(toSafeActionError(e, "Unable to create booking"));
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
      try {
        await invalidateSlotsForResource(booking.resourceId);
      } catch (e) {
        logger.warn({ err: e }, "slot cache invalidate after cancel failed");
      }
      await cancelPendingAutomationForBooking(booking.id);
      try {
        await enqueueBookingCancellation(notifyContext(booking));
      } catch (e) {
        logger.error(
          { err: e, bookingId: booking.id },
          "Failed to enqueue cancellation email",
        );
      }
    }

    if (input.to === "COMPLETED") {
      const org = booking.organization;
      try {
        await enqueuePostVisitAutomation({
          ctx: notifyContext(booking),
          followUpEnabled: org.followUpEnabled,
          followUpHoursAfter: org.followUpHoursAfter,
          reviewRequestEnabled: org.reviewRequestEnabled,
          reviewRequestHoursAfter: org.reviewRequestHoursAfter,
          rebookingEnabled: org.rebookingEnabled,
          rebookingDaysAfter: org.rebookingDaysAfter,
        });
      } catch (e) {
        logger.error(
          { err: e, bookingId: booking.id },
          "Failed to enqueue post-visit automation",
        );
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

    if (input.to === "CANCELLED") {
      void pushGoogleCalendarCancel({
        organizationId: booking.organizationId,
        bookingId: booking.id,
        googleEventId: booking.googleEventId,
      });
    }

    return okEmpty();
  } catch (e) {
    captureException(e, { action: "transitionBooking" });
    logger.error({ err: e }, "transitionBooking failed");
    return err(toSafeActionError(e, "Unable to update booking"));
  }
}

export async function rescheduleBooking(input: {
  organizationId: string;
  bookingId: string;
  startAt: Date;
  actorId?: string | null;
}): Promise<ActionResult<{ bookingId: string }>> {
  try {
    if (Number.isNaN(input.startAt.getTime())) {
      return err("Invalid start time");
    }
    if (input.startAt.getTime() < Date.now() - 60_000) {
      return err("Choose a future time");
    }

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
    if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
      return err("Only upcoming bookings can be rescheduled");
    }

    const endAt = new Date(
      input.startAt.getTime() + booking.service.durationMin * 60_000,
    );
    const paddedStart = new Date(
      input.startAt.getTime() - booking.service.bufferBefore * 60_000,
    );
    const paddedEnd = new Date(
      endAt.getTime() + booking.service.bufferAfter * 60_000,
    );

    const day = formatInTimeZone(
      input.startAt,
      booking.location.timezone,
      "yyyy-MM-dd",
    );
    const slots = await getSlotsForServiceResource({
      organizationId: input.organizationId,
      serviceId: booking.serviceId,
      resourceId: booking.resourceId,
      fromDate: day,
      toDate: day,
      excludeBookingId: booking.id,
    });
    if (!slots.some((s) => s.start.getTime() === input.startAt.getTime())) {
      return err("That time is no longer available");
    }

    const previousStart = booking.startAt;

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashLockKey(booking.resourceId)})`;

      const candidates = await tx.booking.findMany({
        where: {
          resourceId: booking.resourceId,
          status: { in: ACTIVE },
          id: { not: booking.id },
          startAt: { lt: paddedEnd },
          endAt: { gt: paddedStart },
        },
        include: {
          service: { select: { bufferBefore: true, bufferAfter: true } },
        },
      });

      for (const other of candidates) {
        const otherStart =
          other.startAt.getTime() - other.service.bufferBefore * 60_000;
        const otherEnd =
          other.endAt.getTime() + other.service.bufferAfter * 60_000;
        if (
          paddedStart.getTime() < otherEnd &&
          paddedEnd.getTime() > otherStart
        ) {
          throw new Error("SLOT_TAKEN");
        }
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: { startAt: input.startAt, endAt },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          type: "RESCHEDULED",
          actorId: input.actorId ?? null,
          payload: {
            from: previousStart.toISOString(),
            to: input.startAt.toISOString(),
          },
        },
      });
    });

    try {
      await invalidateSlotsForResource(booking.resourceId);
    } catch (e) {
      logger.warn({ err: e }, "slot cache invalidate after reschedule failed");
    }

    await cancelRemindersForBooking(booking.id);
    const notifyCtx = {
      ...notifyContext({
        ...booking,
        startAt: input.startAt,
        endAt,
      }),
      startAt: input.startAt,
      endAt,
    };
    try {
      await enqueueBookingReschedule(notifyCtx);
    } catch (e) {
      logger.error(
        { err: e, bookingId: booking.id },
        "Failed to enqueue reschedule email",
      );
    }
    try {
      await enqueueBookingReminder({
        organizationId: booking.organizationId,
        bookingId: booking.id,
        startAt: input.startAt,
        reminderHoursBefore: booking.organization.reminderHoursBefore,
        plan: booking.organization.plan,
        organizationName: booking.organization.name,
        organizationSlug: booking.organization.slug,
        manageToken: booking.manageToken,
        clientName: booking.client.name,
        serviceName: booking.service.name,
        resourceName: booking.resource.name,
        timezone: booking.location.timezone,
        email: booking.client.email,
        phone: booking.client.phone,
        logoUrl: booking.organization.logoUrl,
        brandPrimary: booking.organization.brandPrimary,
        customDomain: booking.organization.customDomain,
        customDomainStatus: booking.organization.customDomainStatus,
        reviewUrl: booking.organization.reviewUrl,
      });
    } catch (e) {
      logger.error(
        { err: e, bookingId: booking.id },
        "Failed to enqueue reminder after reschedule",
      );
    }

    void pushGoogleCalendarUpsert({
      organizationId: booking.organizationId,
      bookingId: booking.id,
      googleEventId: booking.googleEventId,
      summary: `${booking.service.name} · ${booking.client.name}`,
      description: `With ${booking.resource.name}`,
      startAt: input.startAt,
      endAt,
      timezone: booking.location.timezone,
    });

    try {
      await writeAuditLog({
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: "booking.rescheduled",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          from: previousStart.toISOString(),
          to: input.startAt.toISOString(),
        },
      });
    } catch (e) {
      logger.error({ err: e }, "Audit log write failed");
    }

    return ok({ bookingId: booking.id });
  } catch (e) {
    if (isBookingOverlapError(e)) {
      return err("That time was just booked — pick another slot");
    }
    if (e instanceof UserFacingError) return err(e.message);
    captureException(e, { action: "rescheduleBooking" });
    logger.error({ err: e }, "rescheduleBooking failed");
    return err(toSafeActionError(e, "Unable to reschedule booking"));
  }
}
