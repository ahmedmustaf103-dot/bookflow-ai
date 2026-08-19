import { describe, expect, it } from "vitest";

import {
  parseForm,
  transitionBookingSchema,
  updateServiceSchema,
} from "@/server/actions/schemas";

describe("transitionBookingSchema", () => {
  it("accepts Complete without a cancelReason", () => {
    const formData = new FormData();
    formData.set("bookingId", "cmstfiltv000104l2p1obsr5f");
    formData.set("to", "COMPLETED");
    const parsed = parseForm(transitionBookingSchema, formData);
    expect(parsed).toEqual({
      ok: true,
      data: {
        bookingId: "cmstfiltv000104l2p1obsr5f",
        to: "COMPLETED",
        cancelReason: undefined,
      },
    });
  });

  it("accepts No-show without a cancelReason", () => {
    const formData = new FormData();
    formData.set("bookingId", "cmstfiltv000104l2p1obsr5f");
    formData.set("to", "NO_SHOW");
    const parsed = parseForm(transitionBookingSchema, formData);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.to).toBe("NO_SHOW");
  });

  it("keeps staff cancel reason", () => {
    const formData = new FormData();
    formData.set("bookingId", "cmstfiltv000104l2p1obsr5f");
    formData.set("to", "CANCELLED");
    formData.set("cancelReason", "Cancelled by staff");
    const parsed = parseForm(transitionBookingSchema, formData);
    expect(parsed).toEqual({
      ok: true,
      data: {
        bookingId: "cmstfiltv000104l2p1obsr5f",
        to: "CANCELLED",
        cancelReason: "Cancelled by staff",
      },
    });
  });
});

describe("updateServiceSchema", () => {
  it("converts the active checkbox and keeps description empty as null", () => {
    const formData = new FormData();
    formData.set("serviceId", "cmstfiltv000104l2p1obsr5f");
    formData.set("name", "Beard sculpt");
    formData.set("durationMin", "30");
    formData.set("price", "24");
    formData.set("bufferBefore", "0");
    formData.set("bufferAfter", "5");
    formData.set("isActive", "on");
    const parsed = parseForm(updateServiceSchema, formData);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.isActive).toBe(true);
    expect(parsed.data.description).toBeNull();
    expect(parsed.data.price).toBe(24);
  });

  it("treats a missing active checkbox as inactive", () => {
    const formData = new FormData();
    formData.set("serviceId", "cmstfiltv000104l2p1obsr5f");
    formData.set("name", "Beard sculpt");
    formData.set("durationMin", "30");
    formData.set("price", "24");
    const parsed = parseForm(updateServiceSchema, formData);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.isActive).toBe(false);
  });
});
