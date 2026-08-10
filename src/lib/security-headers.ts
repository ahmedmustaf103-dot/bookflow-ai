/** Shared production security header definitions (also used by next.config). */

export function buildContentSecurityPolicy(options?: {
  isDev?: boolean;
}) {
  const isDev = options?.isDev ?? process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk.com",
    "https://js.stripe.com",
    "https://*.sentry.io",
    "https://vercel.live",
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://api.stripe.com",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://generativelanguage.googleapis.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    "https://api.resend.com",
    "https://*.upstash.io",
    "https://*.blob.vercel-storage.com",
    "https://vercel.live",
    ...(isDev
      ? ["ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*"]
      : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.clerk.accounts.dev https://*.clerk.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function buildSecurityHeaders(options?: { isDev?: boolean }) {
  const isDev = options?.isDev ?? process.env.NODE_ENV !== "production";
  const headers = [
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({ isDev }),
    },
  ];
  if (!isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
