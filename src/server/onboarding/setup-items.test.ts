import { describe, expect, it } from "vitest";

import { buildPilotSetupItems, requiredSetupComplete } from "./setup-items";

const ready = {
  hasBusinessName: true,
  hasBranding: true,
  hasServices: true,
  hasStaff: true,
  hasHours: true,
  hasBookingLinkShared: true,
  remindersConfigured: true,
  emailConfigured: true,
  googleConnected: false,
};

describe("pilot setup checklist", () => {
  it("marks required items done without Google Calendar", () => {
    const items = buildPilotSetupItems(ready);
    expect(items.find((i) => i.id === "email")?.label).toBe("Customer emails");
    expect(items.find((i) => i.id === "google")?.optional).toBe(true);
    expect(items.find((i) => i.id === "google")?.done).toBe(false);
    expect(requiredSetupComplete(items)).toBe(true);
  });

  it("is not complete until services and staff exist", () => {
    const items = buildPilotSetupItems({ ...ready, hasServices: false });
    expect(requiredSetupComplete(items)).toBe(false);
    expect(items.find((i) => i.id === "services")?.done).toBe(false);
  });
});
