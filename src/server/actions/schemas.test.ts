import { describe, expect, it } from "vitest";

import {
  parseForm,
  transitionBookingSchema,
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
