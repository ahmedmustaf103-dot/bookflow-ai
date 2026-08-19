import "server-only";

import { db } from "@/server/db/client";

type OrgArgs = { where?: Record<string, unknown> };

function withOrg<T extends OrgArgs>(args: T, organizationId: string): T {
  return {
    ...args,
    where: { ...(args.where ?? {}), organizationId },
  };
}

function modelScope(organizationId: string) {
  return {
    findMany({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
    findFirst({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
    updateMany({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
    deleteMany({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
    count({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
    aggregate({
      args,
      query,
    }: {
      args: OrgArgs;
      query: (args: OrgArgs) => Promise<unknown>;
    }) {
      return query(withOrg(args, organizationId));
    },
  };
}

/**
 * Tenant-scoped Prisma client. Injects organizationId into list/update/delete/count.
 * Prefer this over raw `db` in dashboard code after membership is verified.
 * Creates still require explicit organizationId. For id lookups use findOrg*.
 */
export function tenantDb(organizationId: string) {
  const s = modelScope(organizationId);
  return db.$extends({
    query: {
      location: s,
      resource: s,
      service: s,
      booking: s,
      client: s,
      auditLog: s,
      aiRun: s,
      notificationOutbox: s,
      membership: s,
      subscription: s,
      googleCalendarConnection: s,
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

/** Load a client by id only if it belongs to the organization. */
export async function findOrgClient(organizationId: string, clientId: string) {
  return db.client.findFirst({
    where: { id: clientId, organizationId },
  });
}

/** Load a service by id only if it belongs to the organization. */
export async function findOrgService(
  organizationId: string,
  serviceId: string,
) {
  return db.service.findFirst({
    where: { id: serviceId, organizationId },
  });
}

/** Load a resource by id only if it belongs to the organization. */
export async function findOrgResource(
  organizationId: string,
  resourceId: string,
) {
  return db.resource.findFirst({
    where: { id: resourceId, organizationId },
  });
}
