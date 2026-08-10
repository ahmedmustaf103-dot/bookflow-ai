import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/** Bump when adding Prisma models so next-dev global client is recreated. */
const PRISMA_CLIENT_VERSION = 4;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: number | undefined;
  pgPool: Pool | undefined;
};

function connectionString() {
  // node-pg treats sslmode=require as verify-full today and warns; prefer explicit.
  // channel_binding=require is unsupported by many node drivers.
  try {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.delete("channel_binding");
    if (
      url.searchParams.get("sslmode") === "require" ||
      url.searchParams.get("sslmode") === "prefer" ||
      url.searchParams.get("sslmode") === "verify-ca"
    ) {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return env.DATABASE_URL;
  }
}

function createPrismaClient() {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: connectionString(),
      // Prefer a pooled connection string (Neon/Supabase/PgBouncer) in production.
      max: env.DATABASE_POOL_MAX,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db =
  globalForPrisma.prisma &&
  globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
}
