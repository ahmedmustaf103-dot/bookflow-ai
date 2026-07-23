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
 * Tenant-scoped Prisma client. Injects `organizationId` into reads/updates
 * for models that carry the column. Verify membership before calling.
 * Creates still require an explicit organizationId (type-safe unchecked input).
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
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
