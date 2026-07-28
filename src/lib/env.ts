import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url(),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z
      .string()
      .min(1)
      .default("BookFlow AI <onboarding@resend.dev>"),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_STARTER: z.string().min(1).optional(),
    STRIPE_PRICE_GROWTH: z.string().min(1).optional(),
    STRIPE_PRICE_BUSINESS: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    AI_PROVIDER: z.enum(["openai", "google"]).default("openai"),
    AI_MODEL_OPENAI: z.string().default("gpt-4o-mini"),
    AI_MODEL_GOOGLE: z.string().default("gemini-2.0-flash"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "1" ||
    process.env.npm_lifecycle_event === "lint",
  emptyStringAsUndefined: true,
});
