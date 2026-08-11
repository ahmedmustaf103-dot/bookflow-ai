"use server";

import { revalidatePath } from "next/cache";

import { toSafeActionError, UserFacingError } from "@/lib/action-errors";
import { normalizeBrandPrimary } from "@/lib/branding";
import { parseTags } from "@/lib/client-tags";
import { err, ok, okEmpty, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import { writeAuditLog } from "@/server/billing/entitlements";
import { storeBrandAsset } from "@/server/branding/assets";
import { db } from "@/server/db";
import { tenantDb } from "@/server/db/tenant";
import { cancelPendingMarketingForClient } from "@/server/notifications/outbox";
import { getActiveOrganization } from "@/server/tenant/context";
import {
  activateCustomDomainSchema,
  createManualClientSchema,
  parseForm,
  updateClientSchema,
  updateOrgSettingsSchema,
  uploadBrandAssetSchema,
} from "@/server/actions/schemas";

export async function updateClientAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const parsed = parseForm(updateClientSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const {
    clientId,
    name,
    email,
    phone,
    notes,
    tags: tagsRaw,
    marketingOptIn,
  } = parsed.data;
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
        marketingOptIn,
      },
    });

    if (existing.marketingOptIn && !marketingOptIn) {
      await cancelPendingMarketingForClient({
        organizationId: ctx.organization.id,
        clientId,
      });
    }

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "client.updated",
      entityType: "client",
      entityId: clientId,
      metadata: { marketingOptIn },
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
    const brandPrimary = normalizeBrandPrimary(parsed.data.brandPrimary);
    const customDomain =
      parsed.data.customDomain === "" ? null : parsed.data.customDomain;

    const existing = await db.organization.findUniqueOrThrow({
      where: { id: ctx.organization.id },
      select: { customDomain: true, customDomainStatus: true },
    });

    let customDomainStatus = existing.customDomainStatus;
    if (!customDomain) {
      customDomainStatus = "NONE";
    } else if (customDomain !== existing.customDomain) {
      customDomainStatus = "PENDING";
    }

    await db.organization.update({
      where: { id: ctx.organization.id },
      data: {
        name: parsed.data.name,
        timezoneDefault: parsed.data.timezoneDefault,
        reminderHoursBefore: parsed.data.reminderHoursBefore,
        publicBookingEnabled: parsed.data.publicBookingEnabled,
        followUpEnabled: parsed.data.followUpEnabled,
        followUpHoursAfter: parsed.data.followUpHoursAfter,
        reviewRequestEnabled: parsed.data.reviewRequestEnabled,
        reviewRequestHoursAfter: parsed.data.reviewRequestHoursAfter,
        reviewUrl: parsed.data.reviewUrl,
        rebookingEnabled: parsed.data.rebookingEnabled,
        rebookingDaysAfter: parsed.data.rebookingDaysAfter,
        brandPrimary,
        customDomain,
        customDomainStatus,
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
        followUpEnabled: parsed.data.followUpEnabled,
        reviewRequestEnabled: parsed.data.reviewRequestEnabled,
        rebookingEnabled: parsed.data.rebookingEnabled,
        brandPrimary,
        customDomain,
        customDomainStatus,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath(`/book/${ctx.organization.slug}`);
    return okEmpty();
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return err("That custom domain is already in use");
    }
    return err(toSafeActionError(e, "Unable to update settings"));
  }
}

export async function uploadBrandAssetAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(uploadBrandAssetSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return err("Choose an image file");
  }

  try {
    const url = await storeBrandAsset({
      organizationId: ctx.organization.id,
      kind: parsed.data.kind,
      file,
    });

    await db.organization.update({
      where: { id: ctx.organization.id },
      data:
        parsed.data.kind === "logo"
          ? { logoUrl: url }
          : { faviconUrl: url },
    });

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: `organization.${parsed.data.kind}_uploaded`,
      entityType: "organization",
      entityId: ctx.organization.id,
      metadata: { url },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath(`/book/${ctx.organization.slug}`);
    return ok({ url });
  } catch (e) {
    if (e instanceof UserFacingError) return err(e.message);
    return err(toSafeActionError(e, "Unable to upload image"));
  }
}

export async function clearBrandAssetAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(uploadBrandAssetSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  try {
    await db.organization.update({
      where: { id: ctx.organization.id },
      data:
        parsed.data.kind === "logo"
          ? { logoUrl: null }
          : { faviconUrl: null },
    });
    revalidatePath("/dashboard/settings");
    revalidatePath(`/book/${ctx.organization.slug}`);
    return okEmpty();
  } catch (e) {
    return err(toSafeActionError(e, "Unable to remove image"));
  }
}

export async function activateCustomDomainAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "ADMIN");

  const parsed = parseForm(activateCustomDomainSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  try {
    const org = await db.organization.findUniqueOrThrow({
      where: { id: ctx.organization.id },
      select: { customDomain: true },
    });
    if (!org.customDomain) {
      return err("Add a custom domain first");
    }

    await db.organization.update({
      where: { id: ctx.organization.id },
      data: {
        customDomainStatus: parsed.data.activate ? "ACTIVE" : "PENDING",
      },
    });

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: parsed.data.activate
        ? "organization.custom_domain_activated"
        : "organization.custom_domain_pending",
      entityType: "organization",
      entityId: ctx.organization.id,
      metadata: { customDomain: org.customDomain },
    });

    revalidatePath("/dashboard/settings");
    return okEmpty();
  } catch (e) {
    return err(toSafeActionError(e, "Unable to update custom domain"));
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
        marketingOptIn: parsed.data.marketingOptIn,
      },
    });

    revalidatePath("/dashboard/clients");
    return ok({ id: client.id });
  } catch (e) {
    return err(toSafeActionError(e, "Unable to create client"));
  }
}
