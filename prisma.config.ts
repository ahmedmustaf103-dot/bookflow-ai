import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js precedence: .env.local overrides .env
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Add it to .env.local (see .env.example).",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
