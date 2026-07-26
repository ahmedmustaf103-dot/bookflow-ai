import "server-only";

import type { OrganizationPlan, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getPlanLimits, type PlanLimits } from "@/server/billing/plans";

export type EntitlementCheck =
  | { ok: true; limits: PlanLimits; plan: OrganizationPlan }
  | { ok: false; error: string; limits: PlanLimits; plan: OrganizationPlan };

export async function checkLocationEntitlement(
  organizationId: string,
): Promise<EntitlementCheck> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const limits = getPlanLimits(org.plan);
  if (limits.locations == null) {
    return { ok: true, limits, plan: org.plan };
  }
  const count = await db.location.count({
    where: { organizationId, isActive: true },
  });
  if (count >= limits.locations) {
    return {
      ok: false,
      error: `${org.plan} plan allows ${limits.locations} location(s). Upgrade in Billing.`,
      limits,
      plan: org.plan,
    };
  }
  return { ok: true, limits, plan: org.plan };
}

export async function checkResourceEntitlement(
  organizationId: string,
): Promise<EntitlementCheck> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const limits = getPlanLimits(org.plan);
  if (limits.resources == null) {
    return { ok: true, limits, plan: org.plan };
  }
  const count = await db.resource.count({
    where: { organizationId, isActive: true },
  });
  if (count >= limits.resources) {
    return {
      ok: false,
      error: `${org.plan} plan allows ${limits.resources} staff/resource(s). Upgrade in Billing.`,
      limits,
      plan: org.plan,
    };
  }
  return { ok: true, limits, plan: org.plan };
}

export function planAllowsReminders(plan: OrganizationPlan) {
  return plan === "GROWTH" || plan === "BUSINESS" || plan === "TRIAL";
}

export async function writeAuditLog(input: {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
