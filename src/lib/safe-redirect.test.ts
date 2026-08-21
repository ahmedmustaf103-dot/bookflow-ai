import { describe, expect, it } from "vitest";

import { safeAuthRedirectPath } from "./safe-redirect";

describe("safeAuthRedirectPath", () => {
  it("allows invite and dashboard paths", () => {
    expect(safeAuthRedirectPath("/invite/abc")).toBe("/invite/abc");
    expect(safeAuthRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("rejects open redirects", () => {
    expect(safeAuthRedirectPath("https://evil.test")).toBe("/dashboard");
    expect(safeAuthRedirectPath("//evil.test")).toBe("/dashboard");
    expect(safeAuthRedirectPath(undefined)).toBe("/dashboard");
  });
});
