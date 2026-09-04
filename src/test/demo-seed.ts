/**
 * Isolated presentation seed for slug `bookflow-demo`.
 * Does not touch E2E (`e2e-test-shop`) or live customer orgs.
 */

import type { PrismaClient } from "../generated/prisma/client";

import {
  assertDemoSlugIsolated,
  DEMO_CLIENTS,
  DEMO_LOCATION_NAME,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  DEMO_OWNER_CLERK_ID,
  DEMO_OWNER_EMAIL,
  DEMO_SERVICES,
  DEMO_STAFF,
  DEMO_TIMEZONE,
  demoClientCreatedAt,
  planDemoBookings,
} from "./demo-shop";

export type DemoSeed = {
  organizationId: string;
  slug: string;
  locationId: string;
  bookingCount: number;
  clientCount: number;
};

export type DemoSeedOptions = {
  now?: Date;
  /** Attach an existing user (e.g. Clerk-synced) as OWNER of the demo org. */
  attachOwnerEmail?: string;
};

const HOSTED_DB_HINT =
  /prisma\.io|neon\.tech|supabase\.co|amazonaws\.com|vercel-storage/i;

export function assertDemoDatabaseAllowed(url: string, allowHosted: boolean) {
  if (HOSTED_DB_HINT.test(url) && !allowHosted) {
    throw new Error(
      "Refusing to seed a hosted/production-looking database. Re-run with DEMO_SEED_ALLOW_HOSTED=1 only if you intend to write the isolated bookflow-demo org.",
    );
  }
}

export async function resetAndSeedDemoOrg(
  db: PrismaClient,
  options: DemoSeedOptions = {},
): Promise<DemoSeed> {
  assertDemoSlugIsolated(DEMO_ORG_SLUG);

  const now = options.now ?? new Date();
  const plan = planDemoBookings(now, DEMO_TIMEZONE);

  await db.organization.deleteMany({ where: { slug: DEMO_ORG_SLUG } });

  const org = await db.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      plan: "BUSINESS",
      timezoneDefault: DEMO_TIMEZONE,
      publicBookingEnabled: true,
      followUpEnabled: true,
      followUpHoursAfter: 2,
      reviewRequestEnabled: true,
      reviewRequestHoursAfter: 72,
      rebookingEnabled: true,
      rebookingDaysAfter: 14,
      reviewUrl: "https://maps.example.test/atelier-hale",
      verticalPack: "barber_salon",
      brandPrimary: "#0F6E56",
      locations: {
        create: {
          name: DEMO_LOCATION_NAME,
          timezone: DEMO_TIMEZONE,
          addressLine1: "18 Redchurch Street",
          city: "London",
          region: "Greater London",
          postalCode: "E2 7DJ",
          country: "GB",
        },
      },
    },
    include: { locations: true },
  });

  const locationId = org.locations[0]!.id;

  const owner = await db.user.upsert({
    where: { clerkUserId: DEMO_OWNER_CLERK_ID },
    update: { email: DEMO_OWNER_EMAIL },
    create: {
      clerkUserId: DEMO_OWNER_CLERK_ID,
      email: DEMO_OWNER_EMAIL,
      firstName: "Jordan",
      lastName: "Hale",
    },
  });
  await db.membership.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  if (options.attachOwnerEmail) {
    const existing = await db.user.findFirst({
      where: { email: options.attachOwnerEmail },
    });
    if (existing && existing.id !== owner.id) {
      await db.membership.upsert({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: existing.id,
          },
        },
        update: { role: "OWNER", status: "ACTIVE" },
        create: {
          organizationId: org.id,
          userId: existing.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
    }
  }

  const staffIds = new Map<string, string>();
  for (const staff of DEMO_STAFF) {
    const user = await db.user.upsert({
      where: { clerkUserId: staff.clerkUserId },
      update: {
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
      },
      create: {
        clerkUserId: staff.clerkUserId,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
      },
    });
    await db.membership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "STAFF",
        status: "ACTIVE",
      },
    });
    const resource = await db.resource.create({
      data: {
        organizationId: org.id,
        locationId,
        userId: user.id,
        name: staff.name,
        type: "STAFF",
        rules: {
          create: staff.weekdays.map((weekday) => ({
            weekday,
            startMin: staff.startMin,
            endMin: staff.endMin,
          })),
        },
      },
    });
    staffIds.set(staff.key, resource.id);
  }

  const serviceIds = new Map<string, string>();
  for (const service of DEMO_SERVICES) {
    const created = await db.service.create({
      data: {
        organizationId: org.id,
        name: service.name,
        durationMin: service.durationMin,
        bufferBefore: 0,
        bufferAfter: service.bufferAfter,
        priceCents: service.priceCents,
        currency: service.currency,
        category: "Barbering",
      },
    });
    serviceIds.set(service.key, created.id);
    for (const staff of DEMO_STAFF) {
      if (!staff.services.includes(service.key)) continue;
      const resourceId = staffIds.get(staff.key);
      if (!resourceId) continue;
      await db.serviceResource.create({
        data: { serviceId: created.id, resourceId },
      });
    }
  }

  const clientIds = new Map<string, string>();
  for (const client of DEMO_CLIENTS) {
    const created = await db.client.create({
      data: {
        organizationId: org.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        tags: client.tags,
        marketingOptIn: client.marketingOptIn,
        createdAt: demoClientCreatedAt(client.key, now, DEMO_TIMEZONE),
      },
    });
    clientIds.set(client.key, created.id);
  }

  for (const row of plan) {
    const resourceId = staffIds.get(row.staffKey);
    const serviceId = serviceIds.get(row.serviceKey);
    const clientId = clientIds.get(row.clientKey);
    if (!resourceId || !serviceId || !clientId) {
      throw new Error(
        `Demo plan referenced a missing catalog id for ${row.token}`,
      );
    }
    await db.booking.create({
      data: {
        organizationId: org.id,
        locationId,
        resourceId,
        serviceId,
        clientId,
        startAt: row.startAt,
        endAt: row.endAt,
        status: row.status,
        source: row.source,
        manageToken: row.token,
        cancelReason: row.cancelReason,
      },
    });
  }

  return {
    organizationId: org.id,
    slug: org.slug,
    locationId,
    bookingCount: plan.length,
    clientCount: DEMO_CLIENTS.length,
  };
}
