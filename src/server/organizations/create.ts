import "server-only";

import { db } from "@/server/db";
import { err, ok, type ActionResult } from "@/lib/result";
import { slugify, withSlugSuffix } from "@/lib/slug";
import { requireDbUser } from "@/server/auth/session";
import { setActiveOrganizationId } from "@/server/tenant/context";

async function allocateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "business";

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate =
      attempt === 0
        ? base
        : withSlugSuffix(base, Math.random().toString(36).slice(2, 6));

    const existing = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return withSlugSuffix(base, Date.now().toString(36));
}

export async function createOrganization(input: {
  name: string;
  timezone?: string;
}): Promise<ActionResult<{ organizationId: string; slug: string }>> {
  const name = input.name.trim();
  if (name.length < 2) {
    return err("Business name must be at least 2 characters");
  }

  const user = await requireDbUser();
  const slug = await allocateUniqueSlug(name);
  const timezone = input.timezone?.trim() || "UTC";

  const organization = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        timezoneDefault: timezone,
        memberships: {
          create: {
            userId: user.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
        locations: {
          create: {
            name: "Main location",
            timezone,
          },
        },
      },
      include: { locations: true },
    });

    const location = org.locations[0];
    if (location) {
      await tx.resource.create({
        data: {
          organizationId: org.id,
          locationId: location.id,
          name: user.firstName
            ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
            : "Primary chair",
          type: "STAFF",
          userId: user.id,
          rules: {
            create: [
              // Mon–Fri 09:00–17:00 local
              ...[1, 2, 3, 4, 5].map((weekday) => ({
                weekday,
                startMin: 9 * 60,
                endMin: 17 * 60,
              })),
            ],
          },
        },
      });
    }

    return org;
  });

  await setActiveOrganizationId(organization.id);

  return ok({ organizationId: organization.id, slug: organization.slug });
}
