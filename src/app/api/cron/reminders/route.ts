import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processDueOutbox } from "@/server/notifications/outbox";

export const runtime = "nodejs";
/** Allow enough time to drain a batch of emails/SMS on cron flush. */
export const maxDuration = 60;

async function authorizeCron(): Promise<NextResponse | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");

  const expected = env.CRON_SECRET;
  if (expected) {
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    // Bearer only — never accept ?secret= (leaks via logs/CDN).
    if (bearer !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is required in production" },
      { status: 503 },
    );
  }
  return null;
}

async function runOutboxCron() {
  const denied = await authorizeCron();
  if (denied) return denied;

  try {
    const result = await processDueOutbox(100);
    logger.info(result, "Processed notification outbox");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Cron notification outbox failed");
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** Vercel Cron invokes GET. External schedulers may use GET or POST. */
export async function GET() {
  return runOutboxCron();
}

export async function POST() {
  return runOutboxCron();
}
