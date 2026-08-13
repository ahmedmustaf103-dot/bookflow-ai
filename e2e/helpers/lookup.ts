import pg from "pg";

import { loadTestEnv } from "../../src/test/load-test-env";

/**
 * Playwright-safe lookup. Avoids the generated Prisma client (import.meta / ESM).
 */
export async function findLatestBookingByEmail(email: string) {
  const connectionString = loadTestEnv();
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{
      id: string;
      status: string;
      manageToken: string;
      serviceName: string;
      resourceName: string;
    }>(
      `SELECT b.id, b.status, b."manageToken",
              s.name AS "serviceName", r.name AS "resourceName"
         FROM bookings b
         JOIN clients c ON c.id = b."clientId"
         JOIN services s ON s.id = b."serviceId"
         JOIN resources r ON r.id = b."resourceId"
        WHERE c.email = $1
        ORDER BY b."createdAt" DESC
        LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      manageToken: row.manageToken,
      service: { name: row.serviceName },
      resource: { name: row.resourceName },
    };
  } finally {
    await client.end();
  }
}
