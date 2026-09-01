import { describe, expect, it } from "vitest";

import { isBookingOverlapError } from "@/server/bookings/overlap";
import { getFeatureFlags, isFeatureEnabled } from "@/server/flags";
import {
  getVerticalPack,
  isVerticalPackId,
  listVerticalPacks,
} from "@/server/verticals/packs";

describe("isBookingOverlapError", () => {
  it("detects SLOT_TAKEN and exclusion constraint failures", () => {
    expect(isBookingOverlapError(new Error("SLOT_TAKEN"))).toBe(true);
    expect(
      isBookingOverlapError(
        new Error(
          'new row violates exclusion constraint "bookings_resource_no_overlap"',
        ),
      ),
    ).toBe(true);
    expect(isBookingOverlapError(new Error("SQLSTATE 23P01"))).toBe(true);
    expect(isBookingOverlapError(new Error("unrelated"))).toBe(false);
  });
});

describe("feature flags", () => {
  it("defaults flags on", () => {
    const prev = process.env.FEATURE_FLAGS;
    delete process.env.FEATURE_FLAGS;
    expect(isFeatureEnabled("slot_cache")).toBe(true);
    expect(isFeatureEnabled("rate_limit")).toBe(true);
    process.env.FEATURE_FLAGS = prev;
  });

  it("applies JSON overrides", () => {
    const prev = process.env.FEATURE_FLAGS;
    process.env.FEATURE_FLAGS = JSON.stringify({ slot_cache: false });
    expect(isFeatureEnabled("slot_cache")).toBe(false);
    expect(isFeatureEnabled("rate_limit")).toBe(true);
    expect(getFeatureFlags().slot_cache).toBe(false);
    process.env.FEATURE_FLAGS = prev;
  });
});

describe("vertical packs", () => {
  it("lists beachhead and expansion packs", () => {
    const ids = listVerticalPacks().map((p) => p.id);
    expect(ids).toContain("barber_salon");
    expect(ids).toContain("dental");
    expect(isVerticalPackId("gyms")).toBe(true);
    expect(isVerticalPackId("unknown")).toBe(false);
  });

  it("falls back to barber_salon", () => {
    expect(getVerticalPack("nope").id).toBe("barber_salon");
    expect(getVerticalPack("dental").terminology.client).toBe("Patient");
  });
});
