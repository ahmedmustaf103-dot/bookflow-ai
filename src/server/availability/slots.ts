import "server-only";

import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { db } from "@/server/db";
import { generateSlots, type Slot } from "@/server/availability/engine";

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

export async function getSlotsForServiceResource(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
  /** Inclusive local YYYY-MM-DD; defaults to today in location TZ */
  fromDate?: string;
  /** Inclusive local YYYY-MM-DD; defaults to fromDate + 6 days */
  toDate?: string;
}): Promise<Slot[]> {
  const service = await db.service.findFirst({
    where: {
      id: input.serviceId,
      organizationId: input.organizationId,
      isActive: true,
    },
  });

  if (!service) {
    throw new Error("Service not found");
  }

  const link = await db.serviceResource.findUnique({
    where: {
      serviceId_resourceId: {
        serviceId: input.serviceId,
        resourceId: input.resourceId,
      },
    },
  });

  // Allow preview even if not linked yet when called from dashboard tooling
  const resource = await db.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: input.organizationId,
      isActive: true,
    },
    include: {
      location: true,
      rules: true,
      overrides: true,
    },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  if (!link && service) {
    // still allow if org admin preview — caller should enforce policy
  }

  const timezone = resource.location.timezone;
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  const fromDate = input.fromDate ?? format(localNow, "yyyy-MM-dd");
  const toDate =
    input.toDate ??
    format(addDays(new Date(`${fromDate}T12:00:00Z`), 6), "yyyy-MM-dd");

  const fromUtc = new Date(`${fromDate}T00:00:00.000Z`);
  const toUtc = new Date(`${toDate}T23:59:59.999Z`);

  const bookings = await db.booking.findMany({
    where: {
      resourceId: resource.id,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startAt: { lt: toUtc },
      endAt: { gt: fromUtc },
    },
    select: { startAt: true, endAt: true },
  });

  return generateSlots({
    timezone,
    fromDate,
    toDate,
    durationMin: service.durationMin,
    bufferBeforeMin: service.bufferBefore,
    bufferAfterMin: service.bufferAfter,
    slotIntervalMin: Math.min(15, service.durationMin),
    rules: resource.rules,
    overrides: resource.overrides,
    busy: bookings.map((b) => ({ start: b.startAt, end: b.endAt })),
    now,
  });
}
