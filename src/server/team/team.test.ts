import { describe, expect, it } from "vitest";

import {
  canAssignInviteRole,
  isInviteableRole,
  normalizeInviteEmail,
} from "./roles";

describe("team invite roles", () => {
  it("lets an owner invite admin, staff, and viewer", () => {
    expect(canAssignInviteRole("OWNER", "ADMIN")).toBe(true);
    expect(canAssignInviteRole("OWNER", "STAFF")).toBe(true);
    expect(canAssignInviteRole("OWNER", "VIEWER")).toBe(true);
  });

  it("lets an admin invite staff and viewer only", () => {
    expect(canAssignInviteRole("ADMIN", "STAFF")).toBe(true);
    expect(canAssignInviteRole("ADMIN", "VIEWER")).toBe(true);
    expect(canAssignInviteRole("ADMIN", "ADMIN")).toBe(false);
  });

  it("never allows inviting an owner or inviting above your rank", () => {
    expect(canAssignInviteRole("OWNER", "OWNER")).toBe(false);
    expect(canAssignInviteRole("ADMIN", "OWNER")).toBe(false);
    expect(canAssignInviteRole("STAFF", "STAFF")).toBe(false);
    expect(canAssignInviteRole("STAFF", "VIEWER")).toBe(false);
    expect(canAssignInviteRole("VIEWER", "VIEWER")).toBe(false);
  });

  it("normalizes invite emails and validates inviteable roles", () => {
    expect(normalizeInviteEmail("  Alex@Shop.TEST ")).toBe("alex@shop.test");
    expect(isInviteableRole("STAFF")).toBe(true);
    expect(isInviteableRole("OWNER")).toBe(false);
  });
});
