import { describe, expect, it } from "vitest";

import { safeAuthRedirectPath } from "./safe-redirect";

describe("safeAuthRedirectPath", () => {
  it("allows invite and dashboard paths", () => {
    expect(safeAuthRedirectPath("/invite/abc")).toBe("/invite/abc");
    expect(safeAuthRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("keeps same-origin invite URLs that Clerk passes as absolute", () => {
    expect(
      safeAuthRedirectPath(
        "http://localhost:3000/invite/e77713340d37199c083a381c8137da33fe86453814ea80d0cb5b7f127cba85ab",
      ),
    ).toBe(
      "/invite/e77713340d37199c083a381c8137da33fe86453814ea80d0cb5b7f127cba85ab",
    );
  });

  it("rejects open redirects", () => {
    expect(safeAuthRedirectPath("https://evil.test")).toBe("/dashboard");
    expect(safeAuthRedirectPath("https://evil.test/invite/abc")).toBe(
      "/dashboard",
    );
    expect(safeAuthRedirectPath("//evil.test")).toBe("/dashboard");
    expect(safeAuthRedirectPath(undefined)).toBe("/dashboard");
  });
});
