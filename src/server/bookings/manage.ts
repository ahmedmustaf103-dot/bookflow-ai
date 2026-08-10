import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import type { BookingStatus } from "@/generated/prisma/client";
import { publicBookingUrl } from "@/lib/booking-urls";
import type { PublicManagedBookingView } from "@/lib/booking-types";
import { toSafeActionError } from "@/lib/action-errors";
import { err, ok, type ActionResult } from "@/lib/result";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/observability";
import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import {
  rescheduleBooking,
  transitionBooking,
} from "@/server/bookings/service";

const MANAGEABLE: BookingStatus[] = ["PENDING", "CONFIRMED"];

export type PublicManagedBooking = PublicManagedBookingView;

function toPublicView(booking: {
  status: BookingStatus;
  startAt: Date;
  endAt: Date;
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    brandPrimary: string | null;
    publicBookingEnabled: boolean;
    customDomain: string | null;
    customDomainStatus: string | null;
  };
  service: { name: string; durationMin: number };
  resource: { name: string };
  location: { name: string; timezone: string };
}): PublicManagedBookingView {
  const tz = booking.location.timezone;
  const canManage = MANAGEABLE.includes(booking.status);
  return {
    organizationName: booking.organization.name,
    logoUrl: booking.organization.logoUrl,
    brandPrimary: booking.organization.brandPrimary,
    serviceName: booking.service.name,
    resourceName: booking.resource.name,
    locationName: booking.location.name,
    startIso: booking.startAt.toISOString(),
    endIso: booking.endAt.toISOString(),
    timezone: tz,
    status: booking.status,
    canCancel: canManage,
    canReschedule: canManage,
    durationMin: booking.service.durationMin,
    whenLabel: formatInTimeZone(booking.startAt, tz, "EEEE d MMM yyyy · HH:mm"),
    bookAgainHref: booking.organization.publicBookingEnabled
      ? publicBookingUrl(booking.organization)
      : null,
  };
}

async function findBookingByManageToken(manageToken: string) {
  return db.booking.findUnique({
    where: { manageToken },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          brandPrimary: true,
          publicBookingEnabled: true,
          customDomain: true,
          customDomainStatus: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          durationMin: true,
        },
      },
      resource: {
        select: {
          id: true,
          name: true,
        },
      },
      location: {
        select: {
          name: true,
          timezone: true,
        },
      },
    },
  });
}

/** Load a booking for the public manage page. Token is the only identifier. */
export async function getPublicManagedBooking(
  manageToken: string,
): Promise<ActionResult<PublicManagedBooking>> {
  try {
    const booking = await findBookingByManageToken(manageToken);
    if (!booking) return err("Appointment not found");
    return ok(toPublicView(booking));
  } catch (e) {
    captureException(e, { action: "getPublicManagedBooking" });
    logger.error({ err: e }, "getPublicManagedBooking failed");
    return err(toSafeActionError(e, "Unable to load appointment"));
  }
}

export async function cancelPublicManagedBooking(input: {
  manageToken: string;
  cancelReason?: string | null;
}): Promise<ActionResult<PublicManagedBooking>> {
  try {
    const booking = await findBookingByManageToken(input.manageToken);
    if (!booking) return err("Appointment not found");
    if (!MANAGEABLE.includes(booking.status)) {
      if (booking.status === "CANCELLED") {
        return err("This appointment is already cancelled");
      }
      return err("This appointment can no longer be cancelled");
    }

    const result = await transitionBooking({
      organizationId: booking.organization.id,
      bookingId: booking.id,
      to: "CANCELLED",
      actorId: null,
      cancelReason: input.cancelReason ?? "Cancelled by customer",
    });
    if (!result.ok) return result;

    const refreshed = await findBookingByManageToken(input.manageToken);
    if (!refreshed) return err("Appointment not found");
    return ok(toPublicView(refreshed));
  } catch (e) {
    captureException(e, { action: "cancelPublicManagedBooking" });
    logger.error({ err: e }, "cancelPublicManagedBooking failed");
    return err(toSafeActionError(e, "Unable to cancel appointment"));
  }
}

export async function getPublicManageSlots(input: {
  manageToken: string;
}): Promise<ActionResult<Array<{ startIso: string; label: string }>>> {
  try {
    const booking = await findBookingByManageToken(input.manageToken);
    if (!booking) return err("Appointment not found");
    if (!MANAGEABLE.includes(booking.status)) {
      return err("This appointment can no longer be rescheduled");
    }

    const tz = booking.location.timezone;
    const slots = await getSlotsForServiceResource({
      organizationId: booking.organization.id,
      serviceId: booking.service.id,
      resourceId: booking.resource.id,
      requireLink: true,
      excludeBookingId: booking.id,
    });

    return ok(
      slots.slice(0, 48).map((s) => ({
        startIso: s.start.toISOString(),
        label: formatInTimeZone(s.start, tz, "EEE MMM d · HH:mm"),
      })),
    );
  } catch (e) {
    captureException(e, { action: "getPublicManageSlots" });
    logger.error({ err: e }, "getPublicManageSlots failed");
    return err(toSafeActionError(e, "Unable to load times"));
  }
}

export async function reschedulePublicManagedBooking(input: {
  manageToken: string;
  startAt: Date;
}): Promise<ActionResult<PublicManagedBooking>> {
  try {
    const booking = await findBookingByManageToken(input.manageToken);
    if (!booking) return err("Appointment not found");
    if (!MANAGEABLE.includes(booking.status)) {
      return err("This appointment can no longer be rescheduled");
    }

    const result = await rescheduleBooking({
      organizationId: booking.organization.id,
      bookingId: booking.id,
      startAt: input.startAt,
      actorId: null,
    });
    if (!result.ok) return result;

    const refreshed = await findBookingByManageToken(input.manageToken);
    if (!refreshed) return err("Appointment not found");
    return ok(toPublicView(refreshed));
  } catch (e) {
    captureException(e, { action: "reschedulePublicManagedBooking" });
    logger.error({ err: e }, "reschedulePublicManagedBooking failed");
    return err(toSafeActionError(e, "Unable to reschedule appointment"));
  }
}
