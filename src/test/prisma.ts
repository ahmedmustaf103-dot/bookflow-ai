import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../generated/prisma/client";

import { assertNotProductionDatabase } from "./load-test-env";

let pool: Pool | undefined;
let prisma: PrismaClient | undefined;

export function testDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set for tests");
  }
  assertNotProductionDatabase(url);
  return url;
}

export function getTestPrisma() {
  if (prisma) return prisma;
  const connectionString = testDatabaseUrl();
  pool = new Pool({ connectionString, max: 5 });
  prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  return prisma;
}

export async function disconnectTestPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
