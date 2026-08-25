"use server";

import { revalidatePath } from "next/cache";

import { err, type ActionResult } from "@/lib/result";
import { getClientIp } from "@/lib/request-ip";
import {
  cancelPublicManagedBooking,
  getPublicManageSlots,
  getPublicManagedBooking,
  reschedulePublicManagedBooking,
} from "@/server/bookings/manage";
import type { PublicManagedBookingView, PublicSlotDay } from "@/lib/booking-types";
import { assertRateLimit } from "@/server/rate-limit";
import {
  cancelPublicManagedBookingSchema,
  manageTokenSchema,
  parseForm,
  publicManageSlotsSchema,
  reschedulePublicManagedBookingSchema,
} from "@/server/actions/schemas";

async function rateLimitManage(manageToken: string, name: string) {
  const ip = await getClientIp();
  return assertRateLimit({
    name,
    key: `${manageToken.slice(0, 12)}:${ip}`,
    limit: 30,
    windowSec: 60,
    message: "Too many attempts — try again shortly",
  });
}

export async function loadPublicManagedBookingAction(
  manageToken: string,
): Promise<ActionResult<PublicManagedBookingView>> {
  const parsed = manageTokenSchema.safeParse(manageToken);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid management link");
  }

  const limited = await rateLimitManage(parsed.data, "public_manage_load");
  if (!limited.ok) return err(limited.error);

  return getPublicManagedBooking(parsed.data);
}

export async function fetchPublicManageSlotsAction(input: {
  manageToken: string;
}): Promise<ActionResult<PublicSlotDay[]>> {
  const parsed = publicManageSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const limited = await rateLimitManage(
    parsed.data.manageToken,
    "public_manage_slots",
  );
  if (!limited.ok) return err(limited.error);

  return getPublicManageSlots({ manageToken: parsed.data.manageToken });
}

export async function cancelPublicManagedBookingAction(
  formData: FormData,
): Promise<ActionResult<PublicManagedBookingView>> {
  const parsed = parseForm(cancelPublicManagedBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const limited = await rateLimitManage(
    parsed.data.manageToken,
    "public_manage_cancel",
  );
  if (!limited.ok) return err(limited.error);

  const result = await cancelPublicManagedBooking({
    manageToken: parsed.data.manageToken,
    cancelReason: parsed.data.cancelReason ?? "Cancelled by customer",
  });

  if (result.ok) {
    revalidatePath(`/book/manage/${parsed.data.manageToken}`);
  }

  return result;
}

export async function reschedulePublicManagedBookingAction(
  formData: FormData,
): Promise<ActionResult<PublicManagedBookingView>> {
  const parsed = parseForm(reschedulePublicManagedBookingSchema, formData);
  if (!parsed.ok) return err(parsed.error);

  const limited = await rateLimitManage(
    parsed.data.manageToken,
    "public_manage_reschedule",
  );
  if (!limited.ok) return err(limited.error);

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  const result = await reschedulePublicManagedBooking({
    manageToken: parsed.data.manageToken,
    startAt,
  });

  if (result.ok) {
    revalidatePath(`/book/manage/${parsed.data.manageToken}`);
  }

  return result;
}
