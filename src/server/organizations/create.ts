import "server-only";

import { db } from "@/server/db";
import { err, ok, type ActionResult } from "@/lib/result";
import { slugify, withSlugSuffix } from "@/lib/slug";
import { requireDbUser } from "@/server/auth/session";
import { setActiveOrganizationId } from "@/server/tenant/context";
import { isFeatureEnabled } from "@/server/flags";
import {
  getVerticalPack,
  isVerticalPackId,
  type VerticalPackId,
} from "@/server/verticals/packs";

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
  verticalPack?: string;
}): Promise<ActionResult<{ organizationId: string; slug: string }>> {
  const name = input.name.trim();
  if (name.length < 2) {
    return err("Business name must be at least 2 characters");
  }

  const packId: VerticalPackId =
    input.verticalPack && isVerticalPackId(input.verticalPack)
      ? input.verticalPack
      : "barber_salon";
  const pack = getVerticalPack(packId);
  const seedServices =
    isFeatureEnabled("vertical_packs") && pack.defaultServices.length > 0;

  const user = await requireDbUser();
  const slug = await allocateUniqueSlug(name);
  const timezone = input.timezone?.trim() || "UTC";

  const organization = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        slug,
        timezoneDefault: timezone,
        verticalPack: packId,
        memberships: {
          create: {
            userId: user.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
        locations: {
          create: {
            name:
              packId === "dental"
                ? "Main clinic"
                : packId === "gyms"
                  ? "Main gym"
                  : "Main location",
            timezone,
          },
        },
      },
      include: { locations: true },
    });

    const location = org.locations[0];
    let resourceId: string | null = null;

    if (location) {
      const resource = await tx.resource.create({
        data: {
          organizationId: org.id,
          locationId: location.id,
          name: user.firstName
            ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
            : pack.terminology.resource === "Staff"
              ? "Primary chair"
              : `Primary ${pack.terminology.resource.toLowerCase()}`,
          type: "STAFF",
          userId: user.id,
          rules: {
            create: [
              ...[1, 2, 3, 4, 5].map((weekday) => ({
                weekday,
                startMin: 9 * 60,
                endMin: 17 * 60,
              })),
            ],
          },
        },
      });
      resourceId = resource.id;
    }

    if (seedServices && resourceId) {
      for (const svc of pack.defaultServices) {
        const created = await tx.service.create({
          data: {
            organizationId: org.id,
            name: svc.name,
            durationMin: svc.durationMin,
            priceCents: svc.priceCents,
            bufferAfter: svc.bufferAfter ?? 0,
          },
        });
        await tx.serviceResource.create({
          data: {
            serviceId: created.id,
            resourceId,
          },
        });
      }
    }

    return org;
  });

  await setActiveOrganizationId(organization.id);

  return ok({ organizationId: organization.id, slug: organization.slug });
}
