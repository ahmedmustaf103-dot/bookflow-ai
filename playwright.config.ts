import { defineConfig, devices } from "@playwright/test";

import { loadTestEnv } from "./src/test/load-test-env";

const testDbUrl = loadTestEnv();
const port = process.env.E2E_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

const desktopUse =
  process.platform === "darwin"
    ? { ...devices["Desktop Chrome"], channel: "chrome" as const }
    : { ...devices["Desktop Chrome"] };

const mobileUse =
  process.platform === "darwin"
    ? { ...devices["Pixel 5"], channel: "chrome" as const }
    : { ...devices["Pixel 5"] };

const testEnv = {
  ...process.env,
  DATABASE_URL: testDbUrl,
  BOOKFLOW_TEST_DATABASE_URL: testDbUrl,
  SKIP_ENV_VALIDATION: "1",
  NEXT_PUBLIC_APP_URL: baseURL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_e2e_placeholder",
  CLERK_SECRET_KEY: "sk_test_e2e_placeholder",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_e2e_placeholder",
  FEATURE_FLAGS: '{"rate_limit":false,"slot_cache":false}',
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e",
  RESEND_API_KEY: "",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  STRIPE_SECRET_KEY: "",
  OPENAI_API_KEY: "",
  GOOGLE_GENERATIVE_AI_API_KEY: "",
  SENTRY_DSN: "",
  NEXT_PUBLIC_SENTRY_DSN: "",
  SMOKE_ORG_SLUG: "e2e-test-shop",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: desktopUse },
    { name: "mobile", use: mobileUse },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "node scripts/e2e-webserver.mjs",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 420_000,
        env: testEnv,
      },
});
