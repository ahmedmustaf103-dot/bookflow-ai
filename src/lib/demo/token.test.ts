import { describe, expect, it } from "vitest";

import { signDemoToken, verifyDemoToken } from "./token";

describe("demo session token", () => {
  it("accepts a fresh token and rejects a tampered one", async () => {
    const secret = "test-secret-value";
    const token = await signDemoToken(secret, 1_700_000_000);
    expect(token.split(".")[0]).toBe("v1");
    expect(token).not.toMatch(/org|atelier|bookflow-demo/i);
    expect(await verifyDemoToken(secret, token.replace(/.$/, "x"))).toBe(false);
    expect(await verifyDemoToken("other-secret", token)).toBe(false);
    expect(await verifyDemoToken(secret, undefined)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const secret = "test-secret-value";
    const token = await signDemoToken(secret, 1_000);
    expect(await verifyDemoToken(secret, token)).toBe(false);
  });
});
