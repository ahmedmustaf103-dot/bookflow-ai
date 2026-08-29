import "server-only";

import { toSafeActionError } from "@/lib/action-errors";
import { err, ok, type ActionResult } from "@/lib/result";
import { writeAuditLog } from "@/server/billing/entitlements";
import { invalidateSlotsForResource } from "@/server/cache/slots";
import { db } from "@/server/db";

async function orgResourceIds(organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db.resource.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function orgServiceIds(organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db.service.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map((s) => s.id);
}

async function invalidateLinkedResources(resourceIds: string[]) {
  await Promise.all(
    [...new Set(resourceIds)].map((id) => invalidateSlotsForResource(id)),
  );
}

export async function updateService(input: {
  organizationId: string;
  serviceId: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  bufferBefore: number;
  bufferAfter: number;
  isActive: boolean;
  resourceIds: string[];
  actorId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const service = await db.service.findFirst({
    where: { id: input.serviceId, organizationId: input.organizationId },
    include: { resources: { select: { resourceId: true } } },
  });
  if (!service) return err("Service not found");

  const resourceIds = await orgResourceIds(
    input.organizationId,
    input.resourceIds.slice(0, 50),
  );
  const previousResourceIds = service.resources.map((r) => r.resourceId);

  try {
    await db.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: service.id },
        data: {
          name: input.name,
          description: input.description,
          durationMin: input.durationMin,
          priceCents: input.priceCents,
          bufferBefore: input.bufferBefore,
          bufferAfter: input.bufferAfter,
          isActive: input.isActive,
        },
      });
      await tx.serviceResource.deleteMany({ where: { serviceId: service.id } });
      if (resourceIds.length > 0) {
        await tx.serviceResource.createMany({
          data: resourceIds.map((resourceId) => ({
            serviceId: service.id,
            resourceId,
          })),
        });
      }
    });

    await invalidateLinkedResources([...previousResourceIds, ...resourceIds]);
    await writeAuditLog({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "service.updated",
      entityType: "service",
      entityId: service.id,
      metadata: { isActive: input.isActive },
    });
    return ok({ id: service.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update service"));
  }
}

export async function updateResource(input: {
  organizationId: string;
  resourceId: string;
  name: string;
  isActive: boolean;
  serviceIds: string[];
  actorId?: string | null;
  /** undefined = leave unchanged, null = unlink login */
  userId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const resource = await db.resource.findFirst({
    where: { id: input.resourceId, organizationId: input.organizationId },
  });
  if (!resource) return err("Staff member not found");

  const serviceIds = await orgServiceIds(
    input.organizationId,
    input.serviceIds.slice(0, 50),
  );

  const nextUserId = input.userId;
  if (nextUserId) {
    const member = await db.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: nextUserId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!member) return err("That person is not on this team");
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.resource.update({
        where: { id: resource.id },
        data: {
          name: input.name,
          isActive: input.isActive,
          ...(nextUserId !== undefined ? { userId: nextUserId } : {}),
        },
      });
      await tx.serviceResource.deleteMany({
        where: { resourceId: resource.id },
      });
      if (serviceIds.length > 0) {
        await tx.serviceResource.createMany({
          data: serviceIds.map((serviceId) => ({
            serviceId,
            resourceId: resource.id,
          })),
        });
      }
    });

    await invalidateSlotsForResource(resource.id);
    await writeAuditLog({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "resource.updated",
      entityType: "resource",
      entityId: resource.id,
      metadata: {
        isActive: input.isActive,
        ...(nextUserId !== undefined ? { userId: nextUserId } : {}),
      },
    });
    return ok({ id: resource.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update staff"));
  }
}
