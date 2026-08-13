/**
 * Isolated E2E process env. Never inherits .env.local database or provider keys.
 * Clerk placeholders are intentional — the test build must match runtime.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const ROOT = process.cwd();

const HOSTED_DB_MARKERS = [
  "prisma.io",
  "neon.tech",
  "supabase.co",
  "amazonaws.com",
  "vercel-storage",
];

export function assertNotProductionDatabase(url) {
  const lower = url.toLowerCase();
  if (HOSTED_DB_MARKERS.some((marker) => lower.includes(marker))) {
    throw new Error(
      "Refusing to run E2E against a hosted/production-looking DATABASE_URL.",
    );
  }
}

function parseTestFile() {
  return parse(readFileSync(path.join(ROOT, ".env.test")));
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || "(default)"}${parsed.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

export function applyE2eServerEnv() {
  const fromFile = parseTestFile();
  const port = process.env.E2E_PORT ?? fromFile.E2E_PORT ?? "3100";
  const databaseUrl =
    process.env.BOOKFLOW_TEST_DATABASE_URL ||
    fromFile.BOOKFLOW_TEST_DATABASE_URL ||
    fromFile.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL missing for E2E server");
  }
  assertNotProductionDatabase(databaseUrl);

  const env = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    BOOKFLOW_TEST_DATABASE_URL: databaseUrl,
    SKIP_ENV_VALIDATION: "1",
    NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_e2e_placeholder",
    CLERK_SECRET_KEY: "sk_test_e2e_placeholder",
    CLERK_WEBHOOK_SIGNING_SECRET: "whsec_e2e_placeholder",
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
    FEATURE_FLAGS:
      process.env.FEATURE_FLAGS ??
      fromFile.FEATURE_FLAGS ??
      '{"rate_limit":false,"slot_cache":false}',
    DATABASE_POOL_MAX: fromFile.DATABASE_POOL_MAX ?? "5",
    LOG_LEVEL: fromFile.LOG_LEVEL ?? "error",
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e",
    E2E_PORT: port,
    SMOKE_ORG_SLUG: fromFile.SMOKE_ORG_SLUG ?? "e2e-test-shop",
    E2E_ORG_SLUG: fromFile.E2E_ORG_SLUG ?? "e2e-test-shop",
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_FROM_NUMBER: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    OPENAI_API_KEY: "",
    GOOGLE_GENERATIVE_AI_API_KEY: "",
    SENTRY_DSN: "",
    NEXT_PUBLIC_SENTRY_DSN: "",
    GOOGLE_CALENDAR_CLIENT_ID: "",
    GOOGLE_CALENDAR_CLIENT_SECRET: "",
    BLOB_READ_WRITE_TOKEN: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  };

  Object.assign(process.env, env);
  return env;
}

export function logE2eEnv(env = process.env) {
  const clerkPk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const clerkSk = env.CLERK_SECRET_KEY ?? "";
  console.log("[e2e-env] NODE_ENV", env.NODE_ENV);
  console.log("[e2e-env] DATABASE_URL", redactDatabaseUrl(env.DATABASE_URL ?? ""));
  console.log("[e2e-env] NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL);
  console.log("[e2e-env] NEXT_DIST_DIR", env.NEXT_DIST_DIR);
  console.log("[e2e-env] E2E_PORT", env.E2E_PORT);
  console.log(
    "[e2e-env] Clerk publishable",
    clerkPk.includes("placeholder") ? "placeholder" : "non-placeholder",
  );
  console.log(
    "[e2e-env] Clerk secret",
    clerkSk.includes("placeholder") ? "placeholder" : "non-placeholder",
  );
  console.log("[e2e-env] SKIP_ENV_VALIDATION", env.SKIP_ENV_VALIDATION);
  console.log("[e2e-env] FEATURE_FLAGS", env.FEATURE_FLAGS);
  console.log(
    "[e2e-env] providers",
    [
      env.RESEND_API_KEY && "resend",
      env.TWILIO_ACCOUNT_SID && "twilio",
      env.STRIPE_SECRET_KEY && "stripe",
      env.OPENAI_API_KEY && "openai",
      env.GOOGLE_GENERATIVE_AI_API_KEY && "google-ai",
      env.SENTRY_DSN && "sentry",
    ]
      .filter(Boolean)
      .join(",") || "none",
  );
}
