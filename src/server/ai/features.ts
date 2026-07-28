import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { db } from "@/server/db";
import { runAiMessages, runAiText } from "@/server/ai/provider";
import { createOrgAiTools } from "@/server/ai/tools";

const GUARDRAILS = `
You are BookFlow AI, an assistant for appointment-based businesses.
Rules:
- Never invent bookings, clients, or times that tools did not return.
- Never claim you created/cancelled a booking — you only propose; humans confirm.
- Keep answers concise and actionable.
- Do not include raw IDs unless useful for staff.
`.trim();

export async function generateClientSummary(input: {
  organizationId: string;
  userId?: string | null;
  clientId: string;
}) {
  const client = await db.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    include: {
      bookings: {
        orderBy: { startAt: "desc" },
        take: 12,
        include: {
          service: true,
          resource: true,
          location: true,
        },
      },
    },
  });

  if (!client) {
    throw new Error("Client not found");
  }

  const history = client.bookings
    .map((b) => {
      const when = formatInTimeZone(
        b.startAt,
        b.location.timezone,
        "yyyy-MM-dd HH:mm",
      );
      return `- ${when} · ${b.service.name} · ${b.resource.name} · ${b.status}`;
    })
    .join("\n");

  const prompt = `
Client: ${client.name}
Tags: ${client.tags.join(", ") || "none"}
Notes: ${client.notes || "none"}
Recent bookings:
${history || "none"}

Write a short staff prep brief (4-7 bullets): preferences/patterns, risks (no-shows), suggested talking points. No medical claims.
`.trim();

  const result = await runAiText({
    organizationId: input.organizationId,
    userId: input.userId,
    feature: "client_summary",
    system: GUARDRAILS,
    prompt,
  });

  return { text: result.text, usage: result };
}

export async function generateMessageDraft(input: {
  organizationId: string;
  userId?: string | null;
  intent: "reminder" | "win_back" | "thank_you" | "reschedule";
  clientId?: string;
  context?: string;
}) {
  let clientLine = "General customer";
  if (input.clientId) {
    const client = await db.client.findFirst({
      where: { id: input.clientId, organizationId: input.organizationId },
      select: { name: true, tags: true },
    });
    if (client) {
      clientLine = `${client.name} (tags: ${client.tags.join(", ") || "none"})`;
    }
  }

  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true },
  });

  const prompt = `
Business: ${org.name}
Intent: ${input.intent}
Recipient: ${clientLine}
Extra context: ${input.context || "none"}

Draft a short email (subject + body) staff can edit before sending.
Tone: warm, professional, not salesy. No emojis.
`.trim();

  const result = await runAiText({
    organizationId: input.organizationId,
    userId: input.userId,
    feature: "message_draft",
    system: GUARDRAILS,
    prompt,
  });

  return { text: result.text, usage: result };
}

export async function runBookingAssistant(input: {
  organizationId: string;
  userId?: string | null;
  message: string;
}) {
  const tools = createOrgAiTools(input.organizationId);

  const result = await runAiMessages({
    organizationId: input.organizationId,
    userId: input.userId,
    feature: "booking_assistant",
    system: `${GUARDRAILS}

You help staff find slots and draft booking proposals.
Use tools to look up services, resources, clients, and availability.
When ready to book, call proposeBooking — never invent a confirmation.
After proposing, clearly tell the staff member they must confirm in the UI.`,
    messages: [{ role: "user", content: input.message }],
    tools,
    maxSteps: 6,
  });

  return { text: result.text, usage: result };
}
