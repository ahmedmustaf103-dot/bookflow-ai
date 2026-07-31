import { describe, expect, it } from "vitest";

import { normalizePhone } from "@/lib/phone";
import {
  getPlanLimits,
  planAllowsSms,
} from "@/server/billing/plans";

describe("SMS entitlements", () => {
  it("enables SMS on Growth and Business only", () => {
    expect(planAllowsSms("GROWTH")).toBe(true);
    expect(planAllowsSms("BUSINESS")).toBe(true);
    expect(planAllowsSms("STARTER")).toBe(false);
    expect(planAllowsSms("TRIAL")).toBe(false);
    expect(getPlanLimits("GROWTH").smsReminders).toBe(true);
  });
});

describe("normalizePhone", () => {
  it("normalizes US 10-digit and E.164", () => {
    expect(normalizePhone("4155552671")).toBe("+14155552671");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
