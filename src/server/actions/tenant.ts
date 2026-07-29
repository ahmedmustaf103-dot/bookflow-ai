"use server";

import { revalidatePath } from "next/cache";

import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import {
  checkLocationEntitlement,
  checkResourceEntitlement,
  writeAuditLog,
} from "@/server/billing/entitlements";
import { invalidateSlotsForResource } from "@/server/cache/slots";
import { createOrganization } from "@/server/organizations/create";
import { db } from "@/server/db";
import {
  getActiveOrganization,
  setActiveOrganizationId,
} from "@/server/tenant/context";

export async function createOrganizationAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const timezone = String(formData.get("timezone") ?? "UTC");
  const verticalPack = String(formData.get("verticalPack") ?? "barber_salon");

  const result = await createOrganization({ name, timezone, verticalPack });
  if (result.ok) {
    revalidatePath("/dashboard");
  }
  return result;
}

export async function switchOrganizationAction(
  organizationId: string,
): Promise<ActionResult> {
  await requireMembership(organizationId, "VIEWER");
  await setActiveOrganizationId(organizationId);
  revalidatePath("/dashboard");
  return okEmpty();
}

export async function createLocationAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(
    formData.get("timezone") ?? ctx.organization.timezoneDefault,
  ).trim();

  if (name.length < 2) return err("Location name is required");

  const entitlement = await checkLocationEntitlement(ctx.organization.id);
  if (!entitlement.ok) return err(entitlement.error);

  const location = await db.location.create({
    data: {
      organizationId: ctx.organization.id,
      name,
      timezone: timezone || ctx.organization.timezoneDefault,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organization.id,
    actorId: ctx.user.id,
    action: "location.created",
    entityType: "location",
    entityId: location.id,
  });

  revalidatePath("/dashboard/locations");
  return ok({ id: location.id });
}

export async function createResourceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "");
  const type = String(formData.get("type") ?? "STAFF");

  if (name.length < 1) return err("Resource name is required");
  if (!locationId) return err("Location is required");

  const entitlement = await checkResourceEntitlement(ctx.organization.id);
  if (!entitlement.ok) return err(entitlement.error);

  const location = await db.location.findFirst({
    where: { id: locationId, organizationId: ctx.organization.id },
  });
  if (!location) return err("Location not found");

  const resource = await db.resource.create({
    data: {
      organizationId: ctx.organization.id,
      locationId,
      name,
      type: type as "STAFF" | "ROOM" | "EQUIPMENT" | "OTHER",
      rules: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startMin: 9 * 60,
          endMin: 17 * 60,
        })),
      },
    },
  });

  revalidatePath("/dashboard/staff");
  return ok({ id: resource.id });
}

export async function createServiceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const durationMin = Number(formData.get("durationMin") ?? 30);
  const priceCents = Math.round(Number(formData.get("price") ?? 0) * 100);
  const bufferAfter = Number(formData.get("bufferAfter") ?? 0);
  const resourceIds = formData.getAll("resourceIds").map(String);

  if (name.length < 1) return err("Service name is required");
  if (!Number.isFinite(durationMin) || durationMin < 5) {
    return err("Duration must be at least 5 minutes");
  }

  const service = await db.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        organizationId: ctx.organization!.id,
        name,
        durationMin,
        priceCents: Number.isFinite(priceCents) ? priceCents : 0,
        bufferAfter: Number.isFinite(bufferAfter) ? bufferAfter : 0,
      },
    });

    if (resourceIds.length > 0) {
      const resources = await tx.resource.findMany({
        where: {
          id: { in: resourceIds },
          organizationId: ctx.organization!.id,
        },
        select: { id: true },
      });

      if (resources.length > 0) {
        await tx.serviceResource.createMany({
          data: resources.map((r) => ({
            serviceId: created.id,
            resourceId: r.id,
          })),
        });
      }
    }

    return created;
  });

  revalidatePath("/dashboard/services");
  return ok({ id: service.id });
}

export async function updateAvailabilityRulesAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const resourceId = String(formData.get("resourceId") ?? "");
  if (!resourceId) return err("Resource is required");

  const resource = await db.resource.findFirst({
    where: { id: resourceId, organizationId: ctx.organization.id },
  });
  if (!resource) return err("Resource not found");

  const rules: Array<{ weekday: number; startMin: number; endMin: number }> =
    [];

  for (let weekday = 0; weekday <= 6; weekday++) {
    const enabled = formData.get(`day-${weekday}-enabled`) === "on";
    if (!enabled) continue;
    const start = String(formData.get(`day-${weekday}-start`) ?? "09:00");
    const end = String(formData.get(`day-${weekday}-end`) ?? "17:00");
    const startMin = parseHm(start);
    const endMin = parseHm(end);
    if (startMin == null || endMin == null || startMin >= endMin) {
      return err(`Invalid hours for day ${weekday}`);
    }
    rules.push({ weekday, startMin, endMin });
  }

  await db.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { resourceId } });
    if (rules.length > 0) {
      await tx.availabilityRule.createMany({
        data: rules.map((r) => ({ ...r, resourceId })),
      });
    }
  });

  await invalidateSlotsForResource(resourceId);

  revalidatePath("/dashboard/availability");
  return okEmpty();
}

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
