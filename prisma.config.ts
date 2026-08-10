import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js precedence: .env.local overrides .env
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

// `prisma generate` (postinstall / CI) does not need a live DB.
// Migrations and the app still require a real DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
