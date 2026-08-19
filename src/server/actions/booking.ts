"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { toSafeActionError } from "@/lib/action-errors";
import { env } from "@/lib/env";
import { getClientIp } from "@/lib/request-ip";
import { err, ok, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/server/billing/checkout";
import {
  createBooking,
  rescheduleBooking,
  transitionBooking,
} from "@/server/bookings/service";
import { db } from "@/server/db";
import { assertRateLimit } from "@/server/rate-limit";
import { getActiveOrganization } from "@/server/tenant/context";
import {
  checkoutSchema,
  dashboardBookingSchema,
  dashboardSlotsSchema,
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

export async function createDashboardBookingAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    return err("No organization selected");
  }
  await requireMembership(ctx.organization.id, "STAFF");

  const limited = await assertRateLimit({
    name: "dashboard_booking",
    key: `${ctx.organization.id}:${ctx.user.id}`,
    limit: 40,
    windowSec: 60,
    message: "Too many bookings — please wait a minute",
  });
  if (!limited.ok) return err(limited.error);

  const parsed = parseForm(dashboardBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  let name = parsed.data.name;
  let email = parsed.data.email || null;
  let phone = parsed.data.phone ?? null;
  let marketingOptIn = parsed.data.marketingOptIn;

  if (parsed.data.clientId) {
    const existing = await db.client.findFirst({
      where: {
        id: parsed.data.clientId,
        organizationId: ctx.organization.id,
      },
    });
    if (!existing) return err("Client not found");
    name = existing.name;
    email = existing.email;
    phone = parsed.data.phone ?? existing.phone;
    if (!parsed.data.marketingOptIn) {
      marketingOptIn = existing.marketingOptIn;
    }
  }

  const result = await createBooking({
    organizationId: ctx.organization.id,
    serviceId: parsed.data.serviceId,
    resourceId: parsed.data.resourceId,
    startAt,
    client: {
      name,
      email,
      phone,
      notes: parsed.data.notes ?? null,
      marketingOptIn,
    },
    source: "DASHBOARD",
    actorId: ctx.user.id,
    idempotencyKey: `dash:${ctx.organization.id}:${parsed.data.resourceId}:${startAt.toISOString()}:${ctx.user.id}`,
  });

  if (result.ok) {
    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/clients");
  }
  return result;
}

export async function fetchDashboardSlotsAction(input: {
  serviceId: string;
  resourceId: string;
  day: string;
}): Promise<ActionResult<Array<{ startIso: string; label: string }>>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const parsed = dashboardSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const limited = await assertRateLimit({
    name: "dashboard_slots",
    key: `${ctx.organization.id}:${ctx.user.id}`,
    limit: 60,
    windowSec: 60,
  });
  if (!limited.ok) return err(limited.error);

  const resource = await db.resource.findFirst({
    where: {
      id: parsed.data.resourceId,
      organizationId: ctx.organization.id,
      isActive: true,
    },
    include: { location: true },
  });
  if (!resource) return err("Staff member not found");

  try {
    const slots = await getSlotsForServiceResource({
      organizationId: ctx.organization.id,
      serviceId: parsed.data.serviceId,
      resourceId: parsed.data.resourceId,
      fromDate: parsed.data.day,
      toDate: parsed.data.day,
      requireLink: true,
    });
    const tz = resource.location.timezone;
    return ok(
      slots.slice(0, 48).map((s) => ({
        startIso: s.start.toISOString(),
        label: formatInTimeZone(s.start, tz, "HH:mm"),
      })),
    );
  } catch (e) {
    return err(toSafeActionError(e, "Unable to load times"));
  }
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
