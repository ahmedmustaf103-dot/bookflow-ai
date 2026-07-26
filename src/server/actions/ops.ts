"use server";

import { revalidatePath } from "next/cache";

import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import { writeAuditLog } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { getActiveOrganization } from "@/server/tenant/context";

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  if (!clientId) return err("Client required");
  if (name.length < 2) return err("Name is required");

  const existing = await db.client.findFirst({
    where: { id: clientId, organizationId: ctx.organization.id },
  });
  if (!existing) return err("Client not found");

  await db.client.update({
    where: { id: clientId },
    data: {
      name,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      tags,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organization.id,
    actorId: ctx.user.id,
    action: "client.updated",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  return okEmpty();
}

export async function updateOrganizationSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const timezoneDefault = String(formData.get("timezoneDefault") ?? "").trim();
  const reminderHoursBefore = Number(formData.get("reminderHoursBefore") ?? 24);
  const publicBookingEnabled = formData.get("publicBookingEnabled") === "on";

  if (name.length < 2) return err("Business name is required");
  if (!timezoneDefault) return err("Timezone is required");
  if (
    !Number.isFinite(reminderHoursBefore) ||
    reminderHoursBefore < 1 ||
    reminderHoursBefore > 168
  ) {
    return err("Reminder lead time must be between 1 and 168 hours");
  }

  await db.organization.update({
    where: { id: ctx.organization.id },
    data: {
      name,
      timezoneDefault,
      reminderHoursBefore,
      publicBookingEnabled,
    },
  });

  await writeAuditLog({
    organizationId: ctx.organization.id,
    actorId: ctx.user.id,
    action: "organization.settings_updated",
    entityType: "organization",
    entityId: ctx.organization.id,
    metadata: {
      reminderHoursBefore,
      publicBookingEnabled,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return okEmpty();
}

export async function createManualClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return err("Name is required");

  const client = await db.client.create({
    data: {
      organizationId: ctx.organization.id,
      name,
      email: email || null,
      phone: phone || null,
    },
  });

  revalidatePath("/dashboard/clients");
  return ok({ id: client.id });
}
