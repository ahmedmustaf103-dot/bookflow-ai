import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

/**
 * Run work inside a transaction with Postgres RLS org context set.
 * Safe no-op for callers when RLS policies allow NULL session (cron/admin).
 */
export async function withOrgRls<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.organization_id', ${organizationId}, true)
    `;
    return fn(tx);
  });
}

/** Clear org context (tests / admin scripts). */
export async function clearOrgRls(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT set_config('app.organization_id', '', true)`;
}
