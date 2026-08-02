import "server-only";

import { db } from "@/server/db/client";

type OrgArgs = { where?: Record<string, unknown> };

function withOrg<T extends OrgArgs>(args: T, organizationId: string): T {
  return {
    ...args,
    where: { ...(args.where ?? {}), organizationId },
  };
}

/**
 * Tenant-scoped Prisma client. Injects organizationId into list/update/delete/count.
 * Prefer this over raw `db` in dashboard code after membership is verified.
 * Creates still require explicit organizationId.
 */
export function tenantDb(organizationId: string) {
  return db.$extends({
    query: {
      location: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      resource: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      service: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      booking: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      client: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      auditLog: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      aiRun: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        aggregate({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
      notificationOutbox: {
        findMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        findFirst({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        updateMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        deleteMany({ args, query }) {
          return query(withOrg(args, organizationId));
        },
        count({ args, query }) {
          return query(withOrg(args, organizationId));
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;

/** Load a booking by id only if it belongs to the organization. */
export async function findOrgBooking(
  organizationId: string,
  bookingId: string,
) {
  return db.booking.findFirst({
    where: { id: bookingId, organizationId },
  });
}
