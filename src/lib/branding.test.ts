import { describe, expect, it } from "vitest";

import {
  brandSoft,
  normalizeBrandPrimary,
  normalizeCustomDomain,
} from "@/lib/branding";

describe("branding helpers", () => {
  it("normalizes hex colours", () => {
    expect(normalizeBrandPrimary("#0f6e56")).toBe("#0F6E56");
    expect(normalizeBrandPrimary("aabbcc")).toBe("#AABBCC");
    expect(normalizeBrandPrimary("nope")).toBe("#0F6E56");
  });

  it("builds a soft tint", () => {
    expect(brandSoft("#000000")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("normalizes custom domains", () => {
    expect(normalizeCustomDomain("https://Book.Salon.com/path")).toBe(
      "book.salon.com",
    );
    expect(normalizeCustomDomain("not a domain")).toBeNull();
    expect(normalizeCustomDomain("")).toBeNull();
  });
});
