import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processDueOutbox } from "@/server/notifications/outbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  const expected = env.CRON_SECRET;
  if (expected) {
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    if (bearer !== expected && querySecret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET is required in production" },
      { status: 503 },
    );
  }

  try {
    const result = await processDueOutbox(100);
    logger.info(result, "Processed reminder outbox");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error({ err: error }, "Cron reminders failed");
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
