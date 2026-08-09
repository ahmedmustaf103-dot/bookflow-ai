"use server";

import { revalidatePath } from "next/cache";

import { toSafeActionError, toSafeAiError } from "@/lib/action-errors";
import { err, ok, type ActionResult } from "@/lib/result";
import { requireMembership } from "@/server/auth/session";
import type { AiBookingProposal, MessageIntent } from "@/server/ai/constants";
import {
  generateClientSummary,
  generateInsightDigest,
  generateMessageDraft,
  runBookingAssistant,
} from "@/server/ai/features";
import { getConfiguredProvider } from "@/server/ai/provider";
import { createBooking } from "@/server/bookings/service";
import { writeAuditLog } from "@/server/billing/entitlements";
import { getActiveOrganization } from "@/server/tenant/context";
import { assertRateLimit } from "@/server/rate-limit";
import {
  bookingAssistantSchema,
  clientSummarySchema,
  confirmAiBookingSchema,
  messageDraftSchema,
  parseForm,
} from "@/server/actions/schemas";

async function assertAiRateLimit(
  organizationId: string,
  userId: string,
): Promise<ActionResult> {
  const limited = await assertRateLimit({
    name: "ai",
    key: `${organizationId}:${userId}`,
    limit: 30,
    windowSec: 60,
    message: "AI rate limit reached — try again in a minute",
  });
  if (!limited.ok) return err(limited.error);
  return ok(undefined);
}

export async function clientSummaryAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    const rl = await assertAiRateLimit(ctx.organization.id, ctx.user.id);
    if (!rl.ok) return rl;

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const parsed = parseForm(clientSummarySchema, formData);
    if (!parsed.ok) return err(parsed.error);

    const result = await generateClientSummary({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      clientId: parsed.data.clientId,
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(toSafeAiError(e, "AI summary failed"));
  }
}

export async function messageDraftAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    const rl = await assertAiRateLimit(ctx.organization.id, ctx.user.id);
    if (!rl.ok) return rl;

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const parsed = parseForm(messageDraftSchema, formData);
    if (!parsed.ok) return err(parsed.error);

    const result = await generateMessageDraft({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      intent: parsed.data.intent as MessageIntent,
      clientId: parsed.data.clientId,
      context: parsed.data.context,
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(toSafeAiError(e, "AI draft failed"));
  }
}

export async function insightDigestAction(
  formData: FormData,
): Promise<ActionResult<{ text: string; tokens: number }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    const rl = await assertAiRateLimit(ctx.organization.id, ctx.user.id);
    if (!rl.ok) return rl;

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    // formData reserved for future day-range filters
    void formData;

    const result = await generateInsightDigest({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      days: 30,
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
    });
  } catch (e) {
    return err(toSafeAiError(e, "AI insights failed"));
  }
}

export async function bookingAssistantAction(
  formData: FormData,
): Promise<
  ActionResult<{
    text: string;
    tokens: number;
    proposal: AiBookingProposal | null;
  }>
> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    const rl = await assertAiRateLimit(ctx.organization.id, ctx.user.id);
    if (!rl.ok) return rl;

    if (!getConfiguredProvider()) {
      return err("Configure OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const parsed = parseForm(bookingAssistantSchema, formData);
    if (!parsed.ok) return err(parsed.error);

    const result = await runBookingAssistant({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      message: parsed.data.message,
    });

    await writeAuditLog({
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      action: "ai.booking_assistant",
      entityType: "ai_run",
      metadata: { messagePreview: parsed.data.message.slice(0, 120) },
    });

    revalidatePath("/dashboard/ai");
    return ok({
      text: result.text,
      tokens: result.usage.tokensIn + result.usage.tokensOut,
      proposal: result.proposal,
    });
  } catch (e) {
    return err(toSafeActionError(e, "Assistant failed"));
  }
}

/** Staff confirms an AI-proposed booking (human-in-the-loop). */
export async function confirmAiBookingProposalAction(
  formData: FormData,
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const ctx = await getActiveOrganization();
    if (!ctx.organization) return err("No organization selected");
    await requireMembership(ctx.organization.id, "STAFF");

    const limited = await assertRateLimit({
      name: "ai_booking_confirm",
      key: `${ctx.organization.id}:${ctx.user.id}`,
      limit: 20,
      windowSec: 60,
    });
    if (!limited.ok) return err(limited.error);

    const parsed = parseForm(confirmAiBookingSchema, formData);
    if (!parsed.ok) return err(parsed.error);

    const startAt = new Date(parsed.data.startAt);
    if (Number.isNaN(startAt.getTime())) return err("Invalid start time");

    const result = await createBooking({
      organizationId: ctx.organization.id,
      serviceId: parsed.data.serviceId,
      resourceId: parsed.data.resourceId,
      startAt,
      client: {
        name: parsed.data.clientName,
        email: parsed.data.clientEmail || null,
        phone: parsed.data.clientPhone || null,
        notes: parsed.data.notes || "Booked via AI assistant (staff confirmed)",
      },
      source: "AI",
      actorId: ctx.user.id,
      idempotencyKey: `ai:${ctx.organization.id}:${parsed.data.serviceId}:${parsed.data.resourceId}:${startAt.toISOString()}`,
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
      revalidatePath("/dashboard/ai");
    }

    return result;
  } catch (e) {
    return err(toSafeActionError(e, "Could not confirm booking"));
  }
}
