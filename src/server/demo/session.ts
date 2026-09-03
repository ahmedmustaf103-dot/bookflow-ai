import "server-only";

import { cookies } from "next/headers";

import {
  DEMO_COOKIE_NAME,
  DEMO_TTL_SEC,
  demoCookieSecure,
  demoSigningSecret,
  signDemoToken,
  verifyDemoToken,
} from "@/lib/demo/token";
import { BOOKING_TOUR_SLUGS } from "@/lib/onboarding/copy";
import { getOptionalClerkUserId } from "@/server/auth/clerk-id";
import { db } from "@/server/db";
import { tenantDb } from "@/server/db/tenant";

export const DEMO_ORG_SLUG = BOOKING_TOUR_SLUGS[0];

export async function isDemoGuest() {
  const userId = await getOptionalClerkUserId();
  if (userId) return false;
  const secret = demoSigningSecret();
  const jar = await cookies();
  return verifyDemoToken(secret, jar.get(DEMO_COOKIE_NAME)?.value);
}

export async function loadDemoOrganization() {
  return db.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
  });
}

export async function loadDemoGuestContext() {
  if (!(await isDemoGuest())) return null;

  const organization = await loadDemoOrganization();
  if (!organization) return null;

  const membership = await db.membership.findFirst({
    where: {
      organizationId: organization.id,
      role: "OWNER",
      status: "ACTIVE",
    },
    include: { organization: true, user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;

  return {
    isDemo: true as const,
    user: membership.user,
    membership,
    memberships: [membership],
    organization: membership.organization,
    db: tenantDb(organization.id),
  };
}

export async function setDemoSessionCookie() {
  const secret = demoSigningSecret();
  if (!secret) {
    throw new Error("Demo session signing secret is missing");
  }
  const token = await signDemoToken(secret);
  const jar = await cookies();
  jar.set(DEMO_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: demoCookieSecure(),
    maxAge: DEMO_TTL_SEC,
  });
}

export async function clearDemoSessionCookie() {
  const jar = await cookies();
  jar.set(DEMO_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: demoCookieSecure(),
    maxAge: 0,
  });
}
