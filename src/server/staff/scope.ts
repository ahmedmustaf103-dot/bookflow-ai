import "server-only";

import type { MembershipRole, Prisma } from "@/generated/prisma/client";
import { err, ok, type ActionResult } from "@/lib/result";
import { db } from "@/server/db";

export function seesAllOrgBookings(role: MembershipRole) {
  return role === "OWNER" || role === "ADMIN";
}

export type StaffResourceScope =
  { all: true } | { all: false; resourceIds: string[] };

export function bookingWhereForScope(
  scope: StaffResourceScope,
): Prisma.BookingWhereInput {
  if (scope.all) return {};
  return { resourceId: { in: scope.resourceIds } };
}

export async function resolveStaffResourceScope(input: {
  organizationId: string;
  userId: string;
  role: MembershipRole;
}): Promise<StaffResourceScope> {
  if (seesAllOrgBookings(input.role)) {
    return { all: true };
  }

  const rows = await db.resource.findMany({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
    },
    select: { id: true },
  });
  return { all: false, resourceIds: rows.map((r) => r.id) };
}

export async function assertStaffCanAccessResource(input: {
  organizationId: string;
  userId: string;
  role: MembershipRole;
  resourceId: string;
}): Promise<ActionResult> {
  const scope = await resolveStaffResourceScope(input);
  if (scope.all) return ok(undefined);
  if (!scope.resourceIds.includes(input.resourceId)) {
    return err("You can only manage appointments for your own chair");
  }
  return ok(undefined);
}

export async function assertStaffCanAccessBooking(input: {
  organizationId: string;
  userId: string;
  role: MembershipRole;
  bookingId: string;
}): Promise<ActionResult> {
  const booking = await db.booking.findFirst({
    where: {
      id: input.bookingId,
      organizationId: input.organizationId,
    },
    select: { resourceId: true },
  });
  if (!booking) return err("Booking not found");
  return assertStaffCanAccessResource({
    organizationId: input.organizationId,
    userId: input.userId,
    role: input.role,
    resourceId: booking.resourceId,
  });
}

export async function clientVisibleInStaffScope(input: {
  organizationId: string;
  clientId: string;
  scope: StaffResourceScope;
}): Promise<boolean> {
  if (input.scope.all) return true;
  if (input.scope.resourceIds.length === 0) return false;
  const count = await db.booking.count({
    where: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      resourceId: { in: input.scope.resourceIds },
    },
  });
  return count > 0;
}
