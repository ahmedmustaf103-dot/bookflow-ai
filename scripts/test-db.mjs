/**
 * Isolated test Postgres: reuse a running local DB, or start embedded-postgres.
 * Never reads .env.local (avoids prisma.io / production).
 */
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "data/embedded-postgres");

loadEnv({ path: path.join(ROOT, ".env.test"), override: false });
if (process.env.BOOKFLOW_TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.BOOKFLOW_TEST_DATABASE_URL;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL missing after loading .env.test");
}
assertNotProduction(databaseUrl);

function assertNotProduction(url) {
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

function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

function parsePort(url) {
  try {
    return Number(new URL(url).port || 5432);
  } catch {
    return 54329;
  }
}

async function pgCtlPath() {
  const { arch, platform } = process;
  const pkg =
    platform === "darwin" && arch === "arm64"
      ? "@embedded-postgres/darwin-arm64"
      : platform === "darwin"
        ? "@embedded-postgres/darwin-x64"
        : platform === "linux" && arch === "arm64"
          ? "@embedded-postgres/linux-arm64"
          : platform === "linux"
            ? "@embedded-postgres/linux-x64"
            : null;
  if (!pkg) {
    throw new Error(
      `Unsupported platform ${platform}/${arch} for embedded Postgres`,
    );
  }
  const bin = await import(pkg);
  return bin.pg_ctl;
}

function adminUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function startEmbeddedIfNeeded(url) {
  const port = parsePort(url);
  if (await portOpen(port)) {
    return { embedded: false };
  }

  const alreadyInited = fs.existsSync(path.join(DATA_DIR, "postgresql.conf"));
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!alreadyInited) {
    const pgEmbedded = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: "bookflow",
      password: "bookflow",
      port,
      persistent: true,
    });
    try {
      await pgEmbedded.initialise();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/shmget|shared memory|EPERM/i.test(message)) {
        throw new Error(
          "Embedded Postgres could not allocate shared memory (shmget). Run this outside a sandbox, or start Postgres with: docker compose -f docker-compose.test.yml up -d",
        );
      }
      if (!/already|exists|not empty/i.test(message)) {
        throw error;
      }
    }
  }

  // Start via pg_ctl so the server outlives this Node process (no exit-hook stop).
  const pgCtl = await pgCtlPath();
  const logFile = path.join(DATA_DIR, "server.log");
  try {
    await execFileAsync(pgCtl, [
      "-D",
      DATA_DIR,
      "-l",
      logFile,
      "start",
      "-w",
      "-o",
      `-p ${port}`,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already running/i.test(message)) {
      throw new Error(
        `Failed to start test Postgres on ${port}: ${message}. See ${logFile}`,
      );
    }
  }

  for (let i = 0; i < 40; i++) {
    if (await portOpen(port)) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!(await portOpen(port))) {
    throw new Error(`Test Postgres did not listen on ${port}. See ${logFile}`);
  }

  const admin = new pg.Client({ connectionString: adminUrl(url) });
  await admin.connect();
  try {
    const dbName = new URL(url).pathname.replace(/^\//, "").split("?")[0];
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  return { embedded: true };
}

function migrate(url) {
  assertNotProduction(url);
  const host = new URL(url).host;
  console.log(`Migrating isolated test database at ${host}`);
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: url,
        BOOKFLOW_TEST_DATABASE_URL: url,
        SKIP_ENV_VALIDATION: "1",
      },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`prisma migrate deploy exited ${code}`));
    });
  });
}

function nextOpenSlotStart(daysAhead = 3, hour = 10) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCHours(hour, 0, 0, 0);
  return start;
}

async function seed(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM organizations WHERE slug = 'e2e-test-shop'`,
    );

    const org = await client.query(
      `INSERT INTO organizations
        (id, name, slug, plan, "timezoneDefault", "publicBookingEnabled",
         "followUpEnabled", "followUpHoursAfter", "reviewRequestEnabled",
         "reviewRequestHoursAfter", "rebookingEnabled", "rebookingDaysAfter",
         "reviewUrl", "verticalPack", "updatedAt")
       VALUES
        (gen_random_uuid()::text, 'E2E Test Shop', 'e2e-test-shop', 'BUSINESS', 'UTC', true,
         true, 24, true, 72, true, 28, 'https://example.test/review', 'barber_salon', NOW())
       RETURNING id`,
    );
    const organizationId = org.rows[0].id;

    const loc = await client.query(
      `INSERT INTO locations (id, "organizationId", name, timezone, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, 'Test studio', 'UTC', NOW())
       RETURNING id`,
      [organizationId],
    );
    const locationId = loc.rows[0].id;

    const resource = await client.query(
      `INSERT INTO resources (id, "organizationId", "locationId", name, type, "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'Alex Rivera', 'STAFF', NOW())
       RETURNING id`,
      [organizationId, locationId],
    );
    const resourceId = resource.rows[0].id;

    for (let weekday = 0; weekday <= 6; weekday++) {
      await client.query(
        `INSERT INTO availability_rules (id, "resourceId", weekday, "startMin", "endMin")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
        [resourceId, weekday, 9 * 60, 17 * 60],
      );
    }

    const service = await client.query(
      `INSERT INTO services
        (id, "organizationId", name, "durationMin", "bufferBefore", "bufferAfter",
         "priceCents", currency, "updatedAt")
       VALUES
        (gen_random_uuid()::text, $1, 'Haircut', 30, 0, 15, 3500, 'GBP', NOW())
       RETURNING id`,
      [organizationId],
    );
    const serviceId = service.rows[0].id;

    await client.query(
      `INSERT INTO service_resources (id, "serviceId", "resourceId")
       VALUES (gen_random_uuid()::text, $1, $2)`,
      [serviceId, resourceId],
    );

    const person = await client.query(
      `INSERT INTO clients
        (id, "organizationId", name, email, "marketingOptIn", "updatedAt")
       VALUES
        (gen_random_uuid()::text, $1, 'Seeded Client', 'seeded.client@example.test', true, NOW())
       RETURNING id`,
      [organizationId],
    );
    const clientId = person.rows[0].id;

    const startAt = nextOpenSlotStart();
    const endAt = new Date(startAt.getTime() + 30 * 60_000);

    const booking = await client.query(
      `INSERT INTO bookings
        (id, "organizationId", "locationId", "resourceId", "serviceId", "clientId",
         "startAt", "endAt", status, source, "manageToken", "updatedAt")
       VALUES
        (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', 'PUBLIC',
         'e2eactivetoken01', NOW())
       RETURNING id`,
      [
        organizationId,
        locationId,
        resourceId,
        serviceId,
        clientId,
        startAt,
        endAt,
      ],
    );

    return {
      organizationId,
      slug: "e2e-test-shop",
      locationId,
      resourceId,
      serviceId,
      manageToken: "e2eactivetoken01",
      bookingId: booking.rows[0].id,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const command = process.argv[2] ?? "prepare";
  if (command === "url") {
    console.log(databaseUrl);
    return;
  }

  const started = await startEmbeddedIfNeeded(databaseUrl);
  await migrate(databaseUrl);
  const check = new pg.Client({ connectionString: databaseUrl });
  await check.connect();
  try {
    const tables = await check.query(
      `SELECT to_regclass('public.organizations') AS organizations`,
    );
    if (!tables.rows[0]?.organizations) {
      throw new Error(
        `Migrations did not create public.organizations on ${new URL(databaseUrl).host}. Refusing to seed.`,
      );
    }
  } finally {
    await check.end();
  }
  const seeded = await seed(databaseUrl);

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseUrl: databaseUrl.replace(/:[^:@]+@/, ":***@"),
        embedded: started.embedded,
        seed: seeded,
      },
      null,
      2,
    ),
  );

  if (command === "up") {
    console.log("Test Postgres is up. Leave this process running.");
    await new Promise(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
