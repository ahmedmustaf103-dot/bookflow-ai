import { describe, expect, it } from "vitest";

import { canRemoveTeamMember } from "./roles";

describe("canRemoveTeamMember", () => {
  it("lets an owner remove staff or admin, not themselves or another owner", () => {
    expect(canRemoveTeamMember("OWNER", "STAFF", "owner", "staff")).toBe(true);
    expect(canRemoveTeamMember("OWNER", "ADMIN", "owner", "admin")).toBe(true);
    expect(canRemoveTeamMember("OWNER", "OWNER", "owner", "other")).toBe(false);
    expect(canRemoveTeamMember("OWNER", "STAFF", "owner", "owner")).toBe(false);
  });

  it("lets an admin remove staff, not an owner or another admin", () => {
    expect(canRemoveTeamMember("ADMIN", "STAFF", "admin", "staff")).toBe(true);
    expect(canRemoveTeamMember("ADMIN", "ADMIN", "admin", "other")).toBe(false);
    expect(canRemoveTeamMember("ADMIN", "OWNER", "admin", "owner")).toBe(false);
  });

  it("does not let staff remove anyone", () => {
    expect(canRemoveTeamMember("STAFF", "STAFF", "a", "b")).toBe(false);
    expect(canRemoveTeamMember("STAFF", "VIEWER", "a", "b")).toBe(false);
  });
});
