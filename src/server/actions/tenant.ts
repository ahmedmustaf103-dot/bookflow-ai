"use server";

import { revalidatePath } from "next/cache";

import { toSafeActionError } from "@/lib/action-errors";
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
import { tenantDb } from "@/server/db/tenant";
import {
  getActiveOrganization,
  setActiveOrganizationId,
} from "@/server/tenant/context";
import {
  createLocationSchema,
  createOrganizationSchema,
  createResourceSchema,
  createServiceSchema,
  parseForm,
  updateResourceSchema,
  updateServiceSchema,
} from "@/server/actions/schemas";
import { updateResource, updateService } from "@/server/catalog/catalog";

export async function createOrganizationAction(formData: FormData) {
  const parsed = parseForm(createOrganizationSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await createOrganization(parsed.data);
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

  const parsed = parseForm(createLocationSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const entitlement = await checkLocationEntitlement(ctx.organization.id);
  if (!entitlement.ok) return err(entitlement.error);

  try {
    const location = await db.location.create({
      data: {
        organizationId: ctx.organization.id,
        name: parsed.data.name,
        timezone: parsed.data.timezone || ctx.organization.timezoneDefault,
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
  } catch (e) {
    return err(toSafeActionError(e, "Unable to create location"));
  }
}

export async function createResourceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(createResourceSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const entitlement = await checkResourceEntitlement(ctx.organization.id);
  if (!entitlement.ok) return err(entitlement.error);

  const tdb = tenantDb(ctx.organization.id);
  const location = await tdb.location.findFirst({
    where: { id: parsed.data.locationId },
  });
  if (!location) return err("Location not found");

  try {
    const resource = await db.resource.create({
      data: {
        organizationId: ctx.organization.id,
        locationId: parsed.data.locationId,
        name: parsed.data.name,
        type: parsed.data.type,
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
  } catch (e) {
    return err(toSafeActionError(e, "Unable to create resource"));
  }
}

export async function createServiceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(createServiceSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const resourceIds = formData
    .getAll("resourceIds")
    .map(String)
    .filter(Boolean)
    .slice(0, 50);

  try {
    const service = await db.$transaction(async (tx) => {
      const created = await tx.service.create({
        data: {
          organizationId: ctx.organization!.id,
          name: parsed.data.name,
          durationMin: parsed.data.durationMin,
          priceCents: Math.round(parsed.data.price * 100),
          bufferAfter: parsed.data.bufferAfter,
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
  } catch (e) {
    return err(toSafeActionError(e, "Unable to create service"));
  }
}

export async function updateServiceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(updateServiceSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const resourceIds = formData
    .getAll("resourceIds")
    .map(String)
    .filter(Boolean)
    .slice(0, 50);

  const result = await updateService({
    organizationId: ctx.organization.id,
    serviceId: parsed.data.serviceId,
    name: parsed.data.name,
    description: parsed.data.description,
    durationMin: parsed.data.durationMin,
    priceCents: Math.round(parsed.data.price * 100),
    bufferBefore: parsed.data.bufferBefore,
    bufferAfter: parsed.data.bufferAfter,
    isActive: parsed.data.isActive,
    resourceIds,
    actorId: ctx.user.id,
  });

  if (result.ok) {
    revalidatePath("/dashboard/services");
    revalidatePath(`/dashboard/services/${parsed.data.serviceId}`);
    revalidatePath("/dashboard/staff");
  }
  return result;
}

export async function updateResourceAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(updateResourceSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const serviceIds = formData
    .getAll("serviceIds")
    .map(String)
    .filter(Boolean)
    .slice(0, 50);

  const result = await updateResource({
    organizationId: ctx.organization.id,
    resourceId: parsed.data.resourceId,
    name: parsed.data.name,
    isActive: parsed.data.isActive,
    serviceIds,
    actorId: ctx.user.id,
  });

  if (result.ok) {
    revalidatePath("/dashboard/staff");
    revalidatePath(`/dashboard/staff/${parsed.data.resourceId}`);
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/availability");
  }
  return result;
}

export async function updateAvailabilityRulesAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const resourceId = String(formData.get("resourceId") ?? "").trim();
  if (!resourceId || resourceId.length > 64) return err("Resource is required");

  const tdb = tenantDb(ctx.organization.id);
  const resource = await tdb.resource.findFirst({
    where: { id: resourceId },
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

  try {
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
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update hours"));
  }
}

function parseHm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
