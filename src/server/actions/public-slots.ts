"use server";

import { formatInTimeZone } from "date-fns-tz";

import { toSafeActionError } from "@/lib/action-errors";
import { err, ok, type ActionResult } from "@/lib/result";
import { getClientIp } from "@/lib/request-ip";
import { db } from "@/server/db";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { assertRateLimit } from "@/server/rate-limit";
import { publicSlotsSchema } from "@/server/actions/schemas";

export async function fetchPublicSlotsAction(input: {
  organizationId: string;
  serviceId: string;
  resourceId: string;
}): Promise<ActionResult<Array<{ startIso: string; label: string }>>> {
  const parsed = publicSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const ip = await getClientIp();
  const limited = await assertRateLimit({
    name: "public_slots",
    key: `${parsed.data.organizationId}:${ip}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err(limited.error);

  const org = await db.organization.findFirst({
    where: {
      id: parsed.data.organizationId,
      publicBookingEnabled: true,
    },
  });
  if (!org) return err("Organization not found");

  const resource = await db.resource.findFirst({
    where: {
      id: parsed.data.resourceId,
      organizationId: org.id,
      isActive: true,
    },
    include: { location: true },
  });
  if (!resource) return err("Resource not found");

  try {
    const slots = await getSlotsForServiceResource({
      organizationId: org.id,
      serviceId: parsed.data.serviceId,
      resourceId: parsed.data.resourceId,
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
    return err(toSafeActionError(e, "Unable to load times"));
  }
}
