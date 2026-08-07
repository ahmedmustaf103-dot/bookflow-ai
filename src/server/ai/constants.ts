/** Shared AI prompt contracts (safe for tests; no server-only side effects). */

export const GUARDRAILS = `
You are BookFlow AI, a practical assistant for appointment businesses (salons, clinics, tutors, gyms).
Rules:
- Never invent bookings, clients, prices, or times that were not provided by tools or the staff prompt.
- Never claim you created, cancelled, or emailed anyone — you only draft or propose; humans confirm and send.
- Be concise and actionable. Prefer bullets and short paragraphs staff can scan in under a minute.
- No medical diagnoses, legal advice, or guaranteed outcomes.
- Do not include raw database IDs unless staff need them to confirm a proposal.
- Write in clear plain English. No emojis unless the staff asks for them.
`.trim();

export type MessageIntent =
  | "reminder"
  | "win_back"
  | "thank_you"
  | "reschedule"
  | "review_request"
  | "follow_up";

export const INTENT_GUIDANCE: Record<MessageIntent, string> = {
  reminder:
    "Friendly appointment reminder. Include day/time if provided. Soft CTA to reply if they need to change.",
  win_back:
    "Warm re-engagement for a client who has not visited recently. One clear booking CTA. Not pushy or guilt-inducing.",
  thank_you:
    "Short thank-you after a visit. Invite them back subtly. Optional offer for next booking if context suggests it.",
  reschedule:
    "Help them pick a new time. Empathetic, clear options language, ask them to reply with a preferred window.",
  review_request:
    "Polite request for a Google/Facebook review after a good visit. One link placeholder like [REVIEW_LINK]. Never pressure or offer incentives that sound fake.",
  follow_up:
    "Post-visit check-in (how did it go / any questions). Offer to book the next appointment. Keep it personal and brief.",
};

export type AiBookingProposal = {
  serviceId: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  startIso: string;
  label: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  notes: string | null;
  rationale: string | null;
};
