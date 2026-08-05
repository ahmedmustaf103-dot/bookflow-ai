import { describe, expect, it } from "vitest";

import { formatMoney, parseTags } from "./client-tags";

describe("parseTags", () => {
  it("splits, trims, dedupes case-insensitively", () => {
    expect(parseTags(" vip, Colour, vip , colour ")).toEqual(["vip", "Colour"]);
  });

  it("caps at max", () => {
    expect(parseTags("a,b,c,d", 2)).toEqual(["a", "b"]);
  });

  it("handles empty", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});

describe("formatMoney", () => {
  it("formats GBP", () => {
    expect(formatMoney(2500, "GBP")).toContain("25");
  });
});
