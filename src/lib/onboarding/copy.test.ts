import { describe, expect, it } from "vitest";

import { BOOKING_TOUR_SLUGS, isPublicDemoSlug, onboardingCopy } from "./copy";

describe("onboarding copy", () => {
  it("treats only Atelier Hale as the public demo, not live or e2e shops", () => {
    expect(isPublicDemoSlug("bookflow-demo")).toBe(true);
    expect(isPublicDemoSlug("bookflow")).toBe(false);
    expect(isPublicDemoSlug("e2e-test-shop")).toBe(false);
    expect(BOOKING_TOUR_SLUGS).toEqual(["bookflow-demo"]);
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
      onboardingCopy.demoIntro.kicker,
      onboardingCopy.demoIntro.body,
      onboardingCopy.demoIntro.path,
      onboardingCopy.bookingPage.intro,
      onboardingCopy.bookingWizard.emptyStaff,
      onboardingCopy.bookingWizard.chooseServiceFirst,
      onboardingCopy.bookingWizard.pickFirst,
      ...onboardingCopy.bookingWizard.steps.map((s) => `${s.rail} ${s.title}`),
      onboardingCopy.marketing.heroBody,
      onboardingCopy.marketing.productHeading,
      onboardingCopy.marketing.productIntro,
      onboardingCopy.marketing.howHeading,
      onboardingCopy.marketing.howIntro,
      onboardingCopy.marketing.ctaHeading,
      onboardingCopy.marketing.ctaBody,
      ...onboardingCopy.marketing.steps.map((s) => `${s.title} ${s.body}`),
      ...onboardingCopy.marketing.capabilities.map(
        (s) => `${s.title} ${s.body}`,
      ),
      ...onboardingCopy.bookingTour.steps,
      ...onboardingCopy.ownerTour.steps,
      ...onboardingCopy.staffTour.steps,
    ]
      .map((s) => (typeof s === "string" ? s : `${s.title} ${s.body}`))
      .join(" ")
      .toLowerCase();

    expect(allText).not.toMatch(
      /\b(slug|dns|oauth|webhook|api|database|outbox)\b/,
    );
    expect(onboardingCopy.bookingWizard.steps).toHaveLength(5);
    expect(onboardingCopy.common.showGuide).toBe("How it works");
  });
});
