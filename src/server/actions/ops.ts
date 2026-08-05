"use server";

import { revalidatePath } from "next/cache";

import { toSafeActionError } from "@/lib/action-errors";
import { parseTags } from "@/lib/client-tags";
import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import { writeAuditLog } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { tenantDb } from "@/server/db/tenant";
import { getActiveOrganization } from "@/server/tenant/context";
import {
  createManualClientSchema,
  parseForm,
  updateClientSchema,
  updateOrgSettingsSchema,
} from "@/server/actions/schemas";

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const parsed = parseForm(updateClientSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const { clientId, name, email, phone, notes, tags: tagsRaw } = parsed.data;
  const tags = parseTags(tagsRaw);

  try {
    const tdb = tenantDb(ctx.organization.id);
    const existing = await tdb.client.findFirst({
      where: { id: clientId },
    });
    if (!existing) return err("Client not found");

    await tdb.client.updateMany({
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
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update client"));
  }
}

export async function updateOrganizationSettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(updateOrgSettingsSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  try {
    await db.organization.update({
      where: { id: ctx.organization.id },
      data: {
        name: parsed.data.name,
        timezoneDefault: parsed.data.timezoneDefault,
        reminderHoursBefore: parsed.data.reminderHoursBefore,
        publicBookingEnabled: parsed.data.publicBookingEnabled,
      },
    });

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: ctx.organization.id,
      metadata: {
        reminderHoursBefore: parsed.data.reminderHoursBefore,
        publicBookingEnabled: parsed.data.publicBookingEnabled,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    return okEmpty();
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update settings"));
  }
}

export async function createManualClientAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const parsed = parseForm(createManualClientSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  try {
    const client = await db.client.create({
      data: {
        organizationId: ctx.organization.id,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        notes: parsed.data.notes || null,
        tags: parseTags(parsed.data.tags),
      },
    });

    revalidatePath("/dashboard/clients");
    return ok({ id: client.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to create client"));
  }
}
