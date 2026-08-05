import { z } from "zod";

const id = z.string().trim().min(1).max(64);

function optionalText(max: number) {
  return z
    .union([z.string(), z.undefined()])
    .transform((v) => {
      if (v == null) return undefined;
      const t = v.trim();
      return t === "" ? undefined : t;
    })
    .pipe(z.string().max(max).optional());
}

export const publicBookingSchema = z.object({
  organizationId: id,
  serviceId: id,
  resourceId: id,
  startAt: z.string().trim().min(1),
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(254),
  phone: optionalText(32),
  notes: optionalText(2000),
  idempotencyKey: optionalText(128),
});

export const transitionBookingSchema = z.object({
  bookingId: id,
  to: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]),
  cancelReason: optionalText(500),
});

export const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "BUSINESS"]).default("STARTER"),
});

export const publicSlotsSchema = z.object({
  organizationId: id,
  serviceId: id,
  resourceId: id,
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  verticalPack: z
    .enum(["barber_salon", "dental", "tutors", "gyms"])
    .default("barber_salon"),
});

export const createLocationSchema = z.object({
  name: z.string().trim().min(2, "Location name is required").max(120),
  timezone: optionalText(64),
});

export const createResourceSchema = z.object({
  name: z.string().trim().min(1, "Resource name is required").max(120),
  locationId: id,
  type: z.enum(["STAFF", "ROOM", "EQUIPMENT", "OTHER"]).default("STAFF"),
});

export const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(120),
  durationMin: z.coerce.number().int().min(5).max(24 * 60),
  price: z.coerce.number().min(0).max(1_000_000).default(0),
  bufferAfter: z.coerce.number().int().min(0).max(240).default(0),
});

export const updateClientSchema = z.object({
  clientId: id,
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  phone: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 32)),
  notes: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 5000)),
  tags: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 500)),
});

export const createManualClientSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  phone: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 32)),
  notes: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 5000)),
  tags: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 500)),
});

export const updateOrgSettingsSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  timezoneDefault: z.string().trim().min(1, "Timezone is required").max(64),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168),
  publicBookingEnabled: z
    .union([z.literal("on"), z.literal(""), z.undefined()])
    .transform((v) => v === "on"),
});

export const clientSummarySchema = z.object({
  clientId: id,
});

export const messageDraftSchema = z.object({
  intent: z
    .enum(["reminder", "win_back", "thank_you", "reschedule"])
    .default("reminder"),
  clientId: optionalText(64),
  context: optionalText(4000),
});

export const bookingAssistantSchema = z.object({
  message: z.string().trim().min(3, "Ask a question about booking").max(4000),
});

export const confirmAiBookingSchema = z.object({
  serviceId: id,
  resourceId: id,
  startAt: z.string().trim().min(1),
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim())
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Invalid email",
    }),
  clientPhone: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 32)),
  notes: z
    .union([z.string(), z.undefined()])
    .transform((v) => (v ?? "").trim().slice(0, 2000)),
});

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !(key in raw)) {
      raw[key] = value;
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  return { ok: true, data: parsed.data };
}
