import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { getMembershipsForUser, requireDbUser } from "@/server/auth/session";

export const ORG_COOKIE = "bf_org_id";

export async function getActiveOrganization() {
  const user = await requireDbUser();
  const memberships = await getMembershipsForUser(user.id);

  if (memberships.length === 0) {
    return { user, memberships, organization: null, membership: null };
  }

  const jar = await cookies();
  const preferredId = jar.get(ORG_COOKIE)?.value;

  const selected =
    memberships.find((m) => m.organizationId === preferredId) ?? memberships[0];

  return {
    user,
    memberships,
    organization: selected.organization,
    membership: selected,
  };
}

export async function requireOrgOrRedirect() {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership) {
    redirect("/onboarding");
  }
  return {
    ...ctx,
    organization: ctx.organization,
    membership: ctx.membership,
  };
}

export async function setActiveOrganizationId(organizationId: string) {
  const jar = await cookies();
  jar.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function assertOrgAccess(organizationId: string) {
  const user = await requireDbUser();
  const membership = await db.membership.findFirst({
    where: {
      organizationId,
      userId: user.id,
      status: "ACTIVE",
    },
    include: { organization: true },
  });

  if (!membership) {
    throw new Error("Forbidden");
  }

  return { user, membership, organization: membership.organization };
}
