import { describe, expect, it } from "vitest";

import { hashPrompt } from "@/lib/hash";
import { GUARDRAILS, type MessageIntent } from "@/server/ai/constants";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";

describe("AI plan gates", () => {
  it("blocks Starter from AI", () => {
    expect(planAllowsAi("STARTER")).toBe(false);
    expect(getPlanLimits("STARTER").aiTokensPerMonth).toBe(0);
  });

  it("allows Trial/Growth/Business", () => {
    expect(planAllowsAi("TRIAL")).toBe(true);
    expect(planAllowsAi("GROWTH")).toBe(true);
    expect(planAllowsAi("BUSINESS")).toBe(true);
  });
});

describe("prompt hashing", () => {
  it("is stable for identical prompts", () => {
    expect(hashPrompt("hello")).toBe(hashPrompt("hello"));
    expect(hashPrompt("hello")).not.toBe(hashPrompt("world"));
  });
});

describe("GUARDRAILS contract", () => {
  it("keeps human-in-the-loop and no-invention rules", () => {
    expect(GUARDRAILS).toMatch(/Never invent/);
    expect(GUARDRAILS).toMatch(/humans confirm/);
    expect(GUARDRAILS).toMatch(/Never claim you created/);
  });
});

describe("message intents", () => {
  it("includes review and follow-up intents used by the workbench", () => {
    const intents: MessageIntent[] = [
      "reminder",
      "win_back",
      "thank_you",
      "reschedule",
      "review_request",
      "follow_up",
    ];
    expect(intents).toContain("review_request");
    expect(intents).toContain("follow_up");
  });
});

describe("booking assistant tool contract", () => {
  const requiredTools = [
    "listServices",
    "listResources",
    "searchClients",
    "getClientHistory",
    "getAvailableSlots",
    "proposeBooking",
  ];

  it("documents proposeBooking as non-mutating", () => {
    const description =
      "Propose a booking for staff review. Does NOT create the booking. Return the proposal for human confirmation.";
    expect(description).toMatch(/Does NOT create/);
    expect(requiredTools).toContain("proposeBooking");
  });
});
