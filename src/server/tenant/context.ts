import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MembershipRole } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getOptionalClerkUserId } from "@/server/auth/clerk-id";
import { getMembershipsForUser, requireDbUser } from "@/server/auth/session";
import { isDemoGuest, loadDemoGuestContext } from "@/server/demo/session";
import { tenantDb } from "@/server/db/tenant";

const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const ORG_COOKIE = "bf_org_id";

export async function getActiveOrganization() {
  const userId = await getOptionalClerkUserId();

  if (!userId) {
    const demo = await loadDemoGuestContext();
    if (demo) return demo;
    return {
      isDemo: false as const,
      user: null,
      memberships: [],
      organization: null,
      membership: null,
    };
  }

  const user = await requireDbUser();
  const memberships = await getMembershipsForUser(user.id);

  if (memberships.length === 0) {
    return {
      isDemo: false as const,
      user,
      memberships,
      organization: null,
      membership: null,
    };
  }

  const jar = await cookies();
  const preferredId = jar.get(ORG_COOKIE)?.value;

  const selected =
    memberships.find((m) => m.organizationId === preferredId) ?? memberships[0];

  return {
    isDemo: false as const,
    user,
    memberships,
    organization: selected.organization,
    membership: selected,
  };
}

export async function requireOrgOrRedirect() {
  const ctx = await getActiveOrganization();
  if (!ctx.organization || !ctx.membership || !ctx.user) {
    if (ctx.isDemo || (await isDemoGuest())) redirect("/demo");
    if (!ctx.user) redirect("/sign-in");
    redirect("/onboarding");
  }
  return {
    ...ctx,
    isDemo: ctx.isDemo,
    user: ctx.user,
    organization: ctx.organization,
    membership: ctx.membership,
    db: tenantDb(ctx.organization.id),
  };
}

/** Dashboard page gate — VIEWER cannot access staff PII surfaces. */
export async function requireOrgRole(minRole: MembershipRole) {
  const ctx = await requireOrgOrRedirect();
  if (ROLE_RANK[ctx.membership.role] < ROLE_RANK[minRole]) {
    redirect("/dashboard");
  }
  return ctx;
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
