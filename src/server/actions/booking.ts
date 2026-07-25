"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { BookingStatus } from "@/generated/prisma/client";
import { err, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/server/billing/checkout";
import { env } from "@/lib/env";
import { createBooking, transitionBooking } from "@/server/bookings/service";
import { getActiveOrganization } from "@/server/tenant/context";

export async function createPublicBookingAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string }>> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const resourceId = String(formData.get("resourceId") ?? "");
  const startAtRaw = String(formData.get("startAt") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();

  if (!organizationId || !serviceId || !resourceId || !startAtRaw) {
    return err("Missing booking details");
  }
  if (name.length < 2) return err("Please enter your name");
  if (!email || !email.includes("@")) return err("Please enter a valid email");

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  return createBooking({
    organizationId,
    serviceId,
    resourceId,
    startAt,
    client: { name, email, phone: phone || null, notes: notes || null },
    source: "PUBLIC",
    idempotencyKey: idempotencyKey || null,
  });
}

export async function transitionBookingAction(
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }

  await requireMembership(ctx.organization.id, "STAFF");

  const bookingId = String(formData.get("bookingId") ?? "");
  const to = String(formData.get("to") ?? "") as BookingStatus;
  const cancelReason = String(formData.get("cancelReason") ?? "").trim();

  if (!bookingId || !to) return err("Missing fields");

  const result = await transitionBooking({
    organizationId: ctx.organization.id,
    bookingId,
    to,
    actorId: ctx.user.id,
    cancelReason: cancelReason || null,
  });

  if (result.ok) {
    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
  }

  return result;
}

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) {
    throw new Error("No organization");
  }

  const plan = String(formData.get("plan") ?? "STARTER");
  const priceId =
    plan === "GROWTH"
      ? env.STRIPE_PRICE_GROWTH
      : plan === "BUSINESS"
        ? env.STRIPE_PRICE_BUSINESS
        : env.STRIPE_PRICE_STARTER;

  if (!priceId) {
    throw new Error("Stripe price IDs are not configured");
  }

  const result = await createCheckoutSession({
    organizationId: ctx.organization.id,
    priceId,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(result.data.url);
}

export async function openBillingPortalAction(): Promise<void> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) {
    throw new Error("No organization");
  }

  const result = await createBillingPortalSession(ctx.organization.id);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(result.data.url);
}
