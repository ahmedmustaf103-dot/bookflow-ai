import { config as loadEnv } from "dotenv";
import path from "node:path";

/**
 * Load `.env.test` without reading `.env.local` (which may point at prisma.io).
 * Existing process env wins so CI can inject a service Postgres URL.
 */
export function loadTestEnv() {
  loadEnv({
    path: path.resolve(process.cwd(), ".env.test"),
    override: false,
  });
  process.env.SKIP_ENV_VALIDATION ??= "1";
  if (!process.env.NODE_ENV) {
    Object.assign(process.env, { NODE_ENV: "test" });
  }
  if (process.env.BOOKFLOW_TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.BOOKFLOW_TEST_DATABASE_URL;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing after loading .env.test. Refusing to use a production database.",
    );
  }
  assertNotProductionDatabase(process.env.DATABASE_URL);
  return process.env.DATABASE_URL;
}

export function assertNotProductionDatabase(url: string) {
  const lower = url.toLowerCase();
  if (
    lower.includes("prisma.io") ||
    lower.includes("neon.tech") ||
    lower.includes("supabase.co") ||
    lower.includes("amazonaws.com") ||
    lower.includes("vercel-storage")
  ) {
    throw new Error(
      "Refusing to run tests against a hosted/production-looking DATABASE_URL.",
    );
  }
}
