"use server";

import { formatInTimeZone } from "date-fns-tz";

import { err, ok, type ActionResult } from "@/lib/result";
import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { assertRateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export async function fetchPublicSlotsAction(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
}): Promise<
  ActionResult<Array<{ startIso: string; label: string }>>
> {
  const ip = await getClientIp();
  const limited = await assertRateLimit({
    name: "public_slots",
    key: `${input.organizationId}:${ip}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err(limited.error);

  if (!input.organizationId || !input.serviceId || !input.resourceId) {
    return err("Missing fields");
  }

  const org = await db.organization.findFirst({
    where: {
      id: input.organizationId,
      publicBookingEnabled: true,
    },
  });
  if (!org) return err("Organization not found");

  const resource = await db.resource.findFirst({
    where: {
      id: input.resourceId,
      organizationId: org.id,
      isActive: true,
    },
    include: { location: true },
  });
  if (!resource) return err("Resource not found");

  try {
    const slots = await getSlotsForServiceResource({
      organizationId: org.id,
      serviceId: input.serviceId,
      resourceId: input.resourceId,
      requireLink: true,
    });
    const tz = resource.location.timezone;
    return ok(
      slots.slice(0, 48).map((s) => ({
        startIso: s.start.toISOString(),
        label: formatInTimeZone(s.start, tz, "EEE MMM d · HH:mm"),
      })),
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Unable to load times");
  }
}
