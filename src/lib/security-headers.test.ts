import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security-headers";

describe("security headers", () => {
  it("includes frame denial and nosniff", () => {
    const headers = buildSecurityHeaders({ isDev: false });
    const map = Object.fromEntries(headers.map((h) => [h.key, h.value]));
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Strict-Transport-Security"]).toContain("max-age=");
  });

  it("builds a CSP that allows Clerk and Stripe", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://js.stripe.com");
    expect(csp).toContain("https://*.clerk.com");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows unsafe-eval only in development", () => {
    expect(buildContentSecurityPolicy({ isDev: true })).toContain(
      "'unsafe-eval'",
    );
    expect(buildContentSecurityPolicy({ isDev: false })).not.toContain(
      "'unsafe-eval'",
    );
  });
});
