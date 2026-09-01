import { describe, expect, it } from "vitest";

import { BOOKING_TOUR_SLUGS, isPublicDemoSlug, onboardingCopy } from "./copy";

describe("onboarding copy", () => {
  it("treats live and isolated demo shops as public demos, not the e2e shop", () => {
    expect(isPublicDemoSlug("bookflow")).toBe(true);
    expect(isPublicDemoSlug("bookflow-demo")).toBe(true);
    expect(isPublicDemoSlug("e2e-test-shop")).toBe(false);
    expect(BOOKING_TOUR_SLUGS).toHaveLength(2);
  });

  it("keeps tour copy keyed and in plain language", () => {
    expect(onboardingCopy.bookingTour.steps.map((s) => s.id)).toEqual([
      "service",
      "staff",
      "time",
      "details",
      "confirm",
    ]);
    expect(onboardingCopy.ownerTour.steps.map((s) => s.id)).toEqual([
      "business",
      "services",
      "staff",
      "hours",
      "booking-link",
      "calendar",
    ]);
    expect(onboardingCopy.staffTour.steps.map((s) => s.id)).toEqual([
      "calendar",
      "customers",
      "actions",
    ]);

    const allText = [
      ...onboardingCopy.bookingTour.steps,
      ...onboardingCopy.ownerTour.steps,
      ...onboardingCopy.staffTour.steps,
    ]
      .map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();

    expect(allText).not.toMatch(/\b(slug|dns|oauth|webhook|api|database)\b/);
  });
});
