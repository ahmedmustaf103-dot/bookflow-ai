import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ db: {} }));

import { bookingWhereForScope, seesAllOrgBookings } from "./scope";

describe("staff resource scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets owners and admins see the whole business", () => {
    expect(seesAllOrgBookings("OWNER")).toBe(true);
    expect(seesAllOrgBookings("ADMIN")).toBe(true);
    expect(seesAllOrgBookings("STAFF")).toBe(false);
    expect(seesAllOrgBookings("VIEWER")).toBe(false);
  });

  it("does not filter bookings for owner/admin scope", () => {
    expect(bookingWhereForScope({ all: true })).toEqual({});
  });

  it("limits staff to linked chairs, including none", () => {
    expect(
      bookingWhereForScope({ all: false, resourceIds: ["chair-a"] }),
    ).toEqual({ resourceId: { in: ["chair-a"] } });
    expect(bookingWhereForScope({ all: false, resourceIds: [] })).toEqual({
      resourceId: { in: [] },
    });
  });
});
