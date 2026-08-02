import { describe, expect, it } from "vitest";

import { normalizePhone } from "@/lib/phone";
import { getPlanLimits, planAllowsSms } from "@/server/billing/plans";

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
  it("normalizes US numbers", () => {
    expect(normalizePhone("4155552671")).toBe("+14155552671");
    expect(normalizePhone("1 415 555 2671")).toBe("+14155552671");
  });

  it("normalizes UK mobiles", () => {
    expect(normalizePhone("07700900123")).toBe("+447700900123");
    expect(normalizePhone("07 700 900 123")).toBe("+447700900123");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("+4407700900123")).toBe("+447700900123");
    expect(normalizePhone("7700900123")).toBe("+447700900123");
  });

  it("rejects garbage", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});
