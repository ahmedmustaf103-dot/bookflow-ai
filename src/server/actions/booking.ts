"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { err, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/server/billing/checkout";
import { env } from "@/lib/env";
import { getClientIp } from "@/lib/request-ip";
import {
  createBooking,
  rescheduleBooking,
  transitionBooking,
} from "@/server/bookings/service";
import { assertRateLimit } from "@/server/rate-limit";
import { getActiveOrganization } from "@/server/tenant/context";
import {
  checkoutSchema,
  parseForm,
  publicBookingSchema,
  rescheduleBookingSchema,
  transitionBookingSchema,
} from "@/server/actions/schemas";

export async function createPublicBookingAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string; isFirstBooking?: boolean }>> {
  const parsed = parseForm(publicBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const {
    organizationId,
    serviceId,
    resourceId,
    startAt: startAtRaw,
    name,
    email,
    phone,
    notes,
    idempotencyKey,
    marketingOptIn,
  } = parsed.data;

  const ip = await getClientIp();
  const limited = await assertRateLimit({
    name: "public_booking",
    key: `${organizationId}:${ip}`,
    limit: 20,
    windowSec: 60,
    message: "Too many booking attempts — please wait a minute",
  });
  if (!limited.ok) return err(limited.error);

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  return createBooking({
    organizationId,
    serviceId,
    resourceId,
    startAt,
    client: {
      name,
      email,
      phone: phone ?? null,
      notes: notes ?? null,
      marketingOptIn,
    },
    source: "PUBLIC",
    idempotencyKey: idempotencyKey ?? null,
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

  const limited = await assertRateLimit({
    name: "booking_transition",
    key: `${ctx.organization.id}:${ctx.user.id}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err(limited.error);

  const parsed = parseForm(transitionBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const result = await transitionBooking({
    organizationId: ctx.organization.id,
    bookingId: parsed.data.bookingId,
    to: parsed.data.to,
    actorId: ctx.user.id,
    cancelReason: parsed.data.cancelReason ?? null,
  });

  if (result.ok) {
    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
  }

  return result;
}

export async function rescheduleBookingAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }

  await requireMembership(ctx.organization.id, "STAFF");

  const limited = await assertRateLimit({
    name: "booking_reschedule",
    key: `${ctx.organization.id}:${ctx.user.id}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err(limited.error);

  const parsed = parseForm(rescheduleBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  const result = await rescheduleBooking({
    organizationId: ctx.organization.id,
    bookingId: parsed.data.bookingId,
    startAt,
    actorId: ctx.user.id,
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

  await requireMembership(ctx.organization.id, "ADMIN");

  const limited = await assertRateLimit({
    name: "checkout",
    key: ctx.organization.id,
    limit: 10,
    windowSec: 60,
  });
  if (!limited.ok) {
    throw new Error(limited.error);
  }

  const parsed = parseForm(checkoutSchema, formData);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const plan = parsed.data.plan;
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

  await requireMembership(ctx.organization.id, "ADMIN");

  const result = await createBillingPortalSession(ctx.organization.id);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(result.data.url);
}
