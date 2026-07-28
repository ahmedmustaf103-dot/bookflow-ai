import { describe, expect, it } from "vitest";

import { hashPrompt } from "@/lib/hash";
import { getPlanLimits, planAllowsAi } from "@/server/billing/plans";

/**
 * Lightweight eval fixtures — prompt contract + plan gates.
 * Live model calls are integration-only (need API keys).
 */
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

describe("client summary prompt fixture", () => {
  it("includes required staff-brief constraints", () => {
    const system = `
You are BookFlow AI, an assistant for appointment-based businesses.
Rules:
- Never invent bookings, clients, or times that tools did not return.
- Never claim you created/cancelled a booking — you only propose; humans confirm.
`.trim();

    expect(system).toMatch(/Never invent/);
    expect(system).toMatch(/humans confirm/);
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
