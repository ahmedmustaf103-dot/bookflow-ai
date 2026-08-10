import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { UserFacingError } from "@/lib/action-errors";
import { formatMoney } from "@/lib/client-tags";
import { getOrgAnalytics, getTopServices } from "@/server/analytics/org";
import {
  GUARDRAILS,
  INTENT_GUIDANCE,
  type AiBookingProposal,
  type MessageIntent,
} from "@/server/ai/constants";
import { db } from "@/server/db";
import { runAiMessages, runAiText } from "@/server/ai/provider";
import { createOrgAiTools } from "@/server/ai/tools";

export {
  GUARDRAILS,
  INTENT_GUIDANCE,
  type AiBookingProposal,
  type MessageIntent,
} from "@/server/ai/constants";

function extractProposalFromSteps(steps: unknown): AiBookingProposal | null {
  if (!Array.isArray(steps)) return null;
  for (const step of steps) {
    const toolResults =
      step && typeof step === "object" && "toolResults" in step
        ? (step as { toolResults?: unknown }).toolResults
        : null;
    if (!Array.isArray(toolResults)) continue;
    for (const tr of toolResults) {
      if (!tr || typeof tr !== "object") continue;
      const name =
        "toolName" in tr
          ? String((tr as { toolName: unknown }).toolName)
          : "type" in tr && (tr as { type: string }).type === "tool-result"
            ? String((tr as { toolName?: string }).toolName ?? "")
            : "";
      const output =
        "output" in tr
          ? (tr as { output: unknown }).output
          : "result" in tr
            ? (tr as { result: unknown }).result
            : null;
      if (name !== "proposeBooking" || !output || typeof output !== "object") {
        continue;
      }
      const out = output as {
        ok?: boolean;
        proposal?: AiBookingProposal;
      };
      if (out.ok && out.proposal?.serviceId && out.proposal.startIso) {
        return out.proposal;
      }
    }
  }
  return null;
}

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
        take: 20,
        include: {
          service: true,
          resource: true,
          location: true,
        },
      },
    },
  });

  if (!client) {
    throw new UserFacingError("Client not found");
  }

  const now = Date.now();
  const completed = client.bookings.filter((b) => b.status === "COMPLETED");
  const noShows = client.bookings.filter((b) => b.status === "NO_SHOW").length;
  const cancelled = client.bookings.filter((b) => b.status === "CANCELLED").length;
  const upcoming = client.bookings
    .filter(
      (b) =>
        b.startAt.getTime() >= now &&
        (b.status === "PENDING" || b.status === "CONFIRMED"),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const lastCompleted = completed[0] ?? null;
  const serviceCounts = new Map<string, number>();
  const resourceCounts = new Map<string, number>();
  for (const b of completed) {
    serviceCounts.set(
      b.service.name,
      (serviceCounts.get(b.service.name) ?? 0) + 1,
    );
    resourceCounts.set(
      b.resource.name,
      (resourceCounts.get(b.resource.name) ?? 0) + 1,
    );
  }
  const favoriteService =
    [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";
  const favoriteResource =
    [...resourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";
  const ltvCents = completed.reduce((s, b) => s + b.service.priceCents, 0);
  const currency = completed[0]?.service.currency ?? "GBP";

  const history = client.bookings
    .slice(0, 12)
    .map((b) => {
      const when = formatInTimeZone(
        b.startAt,
        b.location.timezone,
        "yyyy-MM-dd HH:mm",
      );
      return `- ${when} · ${b.service.name} · ${b.resource.name} · ${b.status}`;
    })
    .join("\n");

  const stats = `
Stats:
- Visits on file: ${client.bookings.length} (completed ${completed.length}, no-shows ${noShows}, cancelled ${cancelled})
- Lifetime value (completed): ${formatMoney(ltvCents, currency)}
- Favorite service: ${favoriteService}
- Usually sees: ${favoriteResource}
- Last completed: ${
    lastCompleted
      ? formatInTimeZone(
          lastCompleted.startAt,
          lastCompleted.location.timezone,
          "yyyy-MM-dd",
        ) + ` · ${lastCompleted.service.name}`
      : "none"
  }
- Next upcoming: ${
    upcoming[0]
      ? formatInTimeZone(
          upcoming[0].startAt,
          upcoming[0].location.timezone,
          "yyyy-MM-dd HH:mm",
        ) + ` · ${upcoming[0].service.name}`
      : "none"
  }
`.trim();

  const prompt = `
Prepare a staff-only client brief for the next conversation.

Client: ${client.name}
Email: ${client.email || "n/a"}
Phone: ${client.phone || "n/a"}
Tags: ${client.tags.join(", ") || "none"}
Internal notes: ${client.notes || "none"}

${stats}

Recent bookings:
${history || "none"}

Output exactly these sections with short bullets:
1) Snapshot (who they are + visit pattern)
2) Preferences / patterns
3) Risks (no-shows, cancellations, sensitive notes)
4) Talking points for next visit
5) Suggested next action for staff

Keep under 180 words. No medical claims.
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
  intent: MessageIntent;
  clientId?: string;
  context?: string;
}) {
  let clientBlock = "Recipient: general customer (no profile selected)";
  if (input.clientId) {
    const client = await db.client.findFirst({
      where: { id: input.clientId, organizationId: input.organizationId },
      include: {
        bookings: {
          orderBy: { startAt: "desc" },
          take: 5,
          include: {
            service: true,
            resource: true,
            location: true,
          },
        },
      },
    });
    if (client) {
      const last = client.bookings[0];
      const lastLine = last
        ? `${formatInTimeZone(last.startAt, last.location.timezone, "yyyy-MM-dd HH:mm")} · ${last.service.name} · ${last.status}`
        : "none";
      clientBlock = `
Recipient: ${client.name}
Email: ${client.email || "unknown"}
Tags: ${client.tags.join(", ") || "none"}
Notes: ${client.notes || "none"}
Last booking: ${lastLine}
`.trim();
    }
  }

  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true },
  });

  const guidance = INTENT_GUIDANCE[input.intent];

  const prompt = `
Business: ${org.name}
Intent: ${input.intent}
Intent guidance: ${guidance}
${clientBlock}
Extra context from staff: ${input.context || "none"}

Draft a message staff can edit before sending.
Format exactly:
Subject: ...
Body:
...

Rules:
- Warm, professional, not salesy
- Under 140 words in the body
- Use [BUSINESS_NAME] only if you must; prefer the real business name
- Use [REVIEW_LINK] placeholder when intent is review_request
- No emojis
- Do not invent appointment times not given above
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

export async function generateInsightDigest(input: {
  organizationId: string;
  userId?: string | null;
  days?: number;
}) {
  const days = input.days ?? 30;
  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true, plan: true },
  });
  const analytics = await getOrgAnalytics(input.organizationId, days);
  const topServices = await getTopServices(input.organizationId, days, 5);

  const prompt = `
Business: ${org.name}
Plan: ${org.plan}
Period: last ${days} days

Metrics:
- Bookings total: ${analytics.bookingsTotal}
- Completed: ${analytics.bookingsCompleted}
- No-shows: ${analytics.bookingsNoShow} (rate ${(analytics.noShowRate * 100).toFixed(1)}%)
- Cancelled: ${analytics.bookingsCancelled}
- Upcoming confirmed/pending: ${analytics.upcoming}
- Unique clients (all time): ${analytics.uniqueClients}
- Estimated revenue (completed+confirmed in window): ${formatMoney(analytics.estimatedRevenueCents, analytics.currency)}
Top services: ${
    topServices.map((s) => `${s.name} (${s.count})`).join(", ") || "none"
  }

Write a staff insights briefing with:
1) What went well
2) What needs attention (especially no-shows / gaps)
3) 3 concrete actions for the next week
4) One simple experiment to grow rebooking

Use only the numbers above. Max 200 words. Bullets preferred.
`.trim();

  const result = await runAiText({
    organizationId: input.organizationId,
    userId: input.userId,
    feature: "insight_digest",
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
  const org = await db.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { name: true, timezoneDefault: true },
  });
  const tools = createOrgAiTools(input.organizationId);

  const result = await runAiMessages({
    organizationId: input.organizationId,
    userId: input.userId,
    feature: "booking_assistant",
    system: `${GUARDRAILS}

You help staff at "${org.name}" find slots and draft booking proposals.
Default timezone: ${org.timezoneDefault}.
Workflow:
1) Clarify service + client if missing (use searchClients / listServices).
2) Use getAvailableSlots before proposing times.
3) When you have a concrete recommendation, call proposeBooking once.
4) Summarize the proposal for staff in plain language and remind them they must click Confirm in the UI.
Never invent availability. Prefer 2–3 slot options in text if several fit, then propose the best one.`,
    messages: [{ role: "user", content: input.message }],
    tools,
    maxSteps: 6,
  });

  const proposal = extractProposalFromSteps(result.steps);

  return { text: result.text, usage: result, proposal };
}
