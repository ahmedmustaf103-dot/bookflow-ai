/**
 * HMAC demo-session token. Safe for Edge (middleware) and Node.
 * Payload never includes org IDs — the server always resolves Atelier Hale by slug.
 */

export const DEMO_COOKIE_NAME = "bf_demo";
export const DEMO_TTL_SEC = 60 * 60 * 8;

export function demoCookieSecure() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(sig);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function demoSigningSecret() {
  return process.env.CLERK_SECRET_KEY ?? "";
}

export async function signDemoToken(
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
) {
  const exp = nowSec + DEMO_TTL_SEC;
  const payload = `v1.${exp}`;
  const sig = await hmacSha256(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyDemoToken(secret: string, token: string | undefined) {
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expRaw, sig] = parts;
  if (version !== "v1" || !expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const payload = `${version}.${expRaw}`;
  const expected = await hmacSha256(secret, payload);
  return timingSafeEqual(sig, expected);
}
