import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";

import type { MembershipRole } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { upsertUserFromClerk } from "@/server/users/sync";

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
  OWNER: 4,
};

export async function requireDbUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  let user = await db.user.findUnique({
    where: { clerkUserId },
  });

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new Error("Unauthorized");
    }

    user = await upsertUserFromClerk({
      id: clerkUser.id,
      email_addresses: clerkUser.emailAddresses.map((e) => ({
        email_address: e.emailAddress,
      })),
      first_name: clerkUser.firstName,
      last_name: clerkUser.lastName,
      image_url: clerkUser.imageUrl,
    });

    if (!user) {
      throw new Error("Unable to sync user");
    }
  }

  return user;
}

export async function getMembershipsForUser(userId: string) {
  return db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Require membership with at least `minRole` rank (inclusive). */
export async function requireMembership(
  organizationId: string,
  minRole: MembershipRole = "VIEWER",
) {
  const user = await requireDbUser();

  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    include: { organization: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Forbidden");
  }

  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new Error("Forbidden");
  }

  return { user, membership, organization: membership.organization };
}

export function canManage(role: MembershipRole) {
  return ROLE_RANK[role] >= ROLE_RANK.ADMIN;
}

export function canEditCalendar(role: MembershipRole) {
  return ROLE_RANK[role] >= ROLE_RANK.STAFF;
}
