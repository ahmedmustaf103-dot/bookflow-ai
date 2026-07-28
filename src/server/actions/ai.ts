"use server";

import { revalidatePath } from "next/cache";

import { err, ok, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import {
  generateClientSummary,
  generateMessageDraft,
  runBookingAssistant,
} from "@/server/ai/features";
import { getConfiguredProvider } from "@/server/ai/provider";
import { createBooking } from "@/server/bookings/service";
import { writeAuditLog } from "@/server/billing/entitlements";
import { getActiveOrganization } from "@/server/tenant/context";

export async function clientSummaryAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const clientId = String(formData.get("clientId") ?? "");
    if (!clientId) return err("Client is required");

    const result = await generateClientSummary({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      clientId,
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "AI summary failed");
  }
}

export async function messageDraftAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const intent = String(formData.get("intent") ?? "reminder") as
      "reminder" | "win_back" | "thank_you" | "reschedule";
    const clientId = String(formData.get("clientId") ?? "") || undefined;
    const context = String(formData.get("context") ?? "").trim();

    const result = await generateMessageDraft({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      intent,
      clientId,
      context: context || undefined,
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "AI draft failed");
  }
}

export async function bookingAssistantAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const message = String(formData.get("message") ?? "").trim();
    if (message.length < 3) return err("Ask a question about booking");

    const result = await runBookingAssistant({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      message,
    });

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "ai.booking_assistant",
      entityType: "ai_run",
      metadata: { messagePreview: message.slice(0, 120) },
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Assistant failed");
  }
}

/** Staff confirms an AI-proposed booking (human-in-the-loop). */
export async function confirmAiBookingProposalAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string }>> {
  const ctx = await getActiveOrganization();
  if (!ctx.organization) return err("No organization selected");
  await requireMembership(ctx.organization.id, "STAFF");

  const serviceId = String(formData.get("serviceId") ?? "");
  const resourceId = String(formData.get("resourceId") ?? "");
  const startAtRaw = String(formData.get("startAt") ?? "");
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim();
  const clientPhone = String(formData.get("clientPhone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!serviceId || !resourceId || !startAtRaw || clientName.length < 2) {
    return err("Incomplete proposal");
  }

  const startAt = new Date(startAtRaw);
  if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

  const result = await createBooking({
    organizationId: ctx.organization.id,
    serviceId,
    resourceId,
    startAt,
    client: {
      name: clientName,
      email: clientEmail || null,
      phone: clientPhone || null,
      notes: notes || "Booked via AI assistant (staff confirmed)",
    },
    source: "AI",
    actorId: ctx.user.id,
    idempotencyKey: `ai:${ctx.organization.id}:${serviceId}:${resourceId}:${startAt.toISOString()}`,
  });

  if (result.ok) {
    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "ai.booking_confirmed",
      entityType: "booking",
      entityId: result.data.bookingId,
    });
    revalidatePath("/dashboard/appointments");
  }

  return result;
}
