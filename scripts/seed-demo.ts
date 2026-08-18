/**
 * Seed the isolated presentation org (`bookflow-demo`) only.
 *
 * Default: local test database from `.env.test`.
 * Hosted/production-looking URLs require DEMO_SEED_ALLOW_HOSTED=1.
 *
 *   npm run db:seed:demo
 *   DEMO_SEED_ALLOW_HOSTED=1 DEMO_SEED_OWNER_EMAIL=you@example.com npm run db:seed:demo
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  assertDemoDatabaseAllowed,
  resetAndSeedDemoOrg,
} from "../src/test/demo-seed";
import { loadTestEnv } from "../src/test/load-test-env";
import { DEMO_FORBIDDEN_SLUGS, DEMO_ORG_SLUG } from "../src/test/demo-shop";

const allowHosted =
  process.env.DEMO_SEED_ALLOW_HOSTED === "1" ||
  process.argv.includes("--hosted");

if (allowHosted) {
  loadEnv({
    path: path.resolve(process.cwd(), ".env.local"),
    override: false,
  });
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing after loading .env.local");
  }
} else {
  loadTestEnv();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the demo org");
}

assertDemoDatabaseAllowed(databaseUrl, allowHosted);

async function main() {
  console.log(
    `Seeding slug ${DEMO_ORG_SLUG} only. Will not touch: ${DEMO_FORBIDDEN_SLUGS.join(", ")}.`,
  );

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const db = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error"],
  });

  try {
    const result = await resetAndSeedDemoOrg(db, {
      attachOwnerEmail: process.env.DEMO_SEED_OWNER_EMAIL,
    });
    console.log(
      `Seeded ${result.slug} (${result.organizationId}): ${result.clientCount} clients, ${result.bookingCount} bookings.`,
    );
    console.log(`Public book path: /book/${result.slug}`);
    if (process.env.DEMO_SEED_OWNER_EMAIL) {
      console.log(
        `If the dashboard still shows another shop, set cookie bf_org_id=${result.organizationId} for this browser session.`,
      );
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
