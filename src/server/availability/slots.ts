import "server-only";

import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { db } from "@/server/db";
import { generateSlots, type Slot } from "@/server/availability/engine";
import { getCachedSlots, setCachedSlots } from "@/server/cache/slots";

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"] as const;

export async function getSlotsForServiceResource(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
  /** Inclusive local YYYY-MM-DD; defaults to today in location TZ */
  fromDate?: string;
  /** Inclusive local YYYY-MM-DD; defaults to fromDate + 6 days */
  toDate?: string;
  /** Dashboard preview may allow unlinked pairs; public booking must not */
  requireLink?: boolean;
}): Promise<Slot[]> {
  const requireLink = input.requireLink !== false;

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

  if (requireLink && !link) {
    return [];
  }

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

  const timezone = resource.location.timezone;
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  const fromDate = input.fromDate ?? format(localNow, "yyyy-MM-dd");
  const toDate =
    input.toDate ??
    format(addDays(new Date(`${fromDate}T12:00:00Z`), 6), "yyyy-MM-dd");

  const cacheInput = {
    organizationId: input.organizationId,
    serviceId: input.serviceId,
    resourceId: input.resourceId,
    fromDate,
    toDate,
  };

  const cached = await getCachedSlots(cacheInput);
  if (cached) return cached;

  // Bound busy query using location-local day start/end, not UTC midnight.
  const fromUtc = fromZonedTime(`${fromDate}T00:00:00.000`, timezone);
  const toUtc = fromZonedTime(`${toDate}T23:59:59.999`, timezone);

  const bookings = await db.booking.findMany({
    where: {
      resourceId: resource.id,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startAt: { lt: toUtc },
      endAt: { gt: fromUtc },
    },
    select: { startAt: true, endAt: true },
  });

  const slots = generateSlots({
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

  await setCachedSlots(cacheInput, slots);
  return slots;
}
