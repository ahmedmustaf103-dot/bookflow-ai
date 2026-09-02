import { describe, expect, it } from "vitest";

import {
  bookingTourStorageKey,
  isTourCompleted,
  markTourCompleted,
  ownerTourStorageKey,
  staffTourStorageKey,
} from "./tour-storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("tour storage", () => {
  it("namespaces owner and staff keys per business", () => {
    expect(bookingTourStorageKey()).toBe("bf_tour_booking_v1");
    expect(bookingTourStorageKey("org_1")).toBe("bf_tour_booking_v1_org_1");
    expect(ownerTourStorageKey("org_1")).toBe("bf_tour_owner_v1_org_1");
    expect(staffTourStorageKey("org_1")).toBe("bf_tour_staff_v1_org_1");
    expect(ownerTourStorageKey("org_1")).not.toBe(staffTourStorageKey("org_1"));
  });

  it("marks a tour complete so it does not show again", () => {
    const storage = memoryStorage();
    const key = ownerTourStorageKey("org_1");
    expect(isTourCompleted(key, storage)).toBe(false);
    markTourCompleted(key, storage);
    expect(isTourCompleted(key, storage)).toBe(true);
  });

  it("treats missing storage as not completed", () => {
    expect(isTourCompleted("bf_tour_booking_v1", null)).toBe(false);
  });
});
