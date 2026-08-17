import {
  TEST_BUFFER_AFTER_MIN,
  TEST_LOCATION_NAME,
  TEST_MANAGE_TOKEN,
  TEST_ORG_NAME,
  TEST_ORG_SLUG,
  TEST_SERVICE_DURATION_MIN,
  TEST_SERVICE_NAME,
  TEST_STAFF_NAME,
  TEST_TIMEZONE,
} from "./constants";
import { getTestPrisma } from "./prisma";

export type TestSeed = {
  organizationId: string;
  slug: string;
  locationId: string;
  resourceId: string;
  serviceId: string;
  manageToken: string;
  bookingId: string;
};

export async function resetAndSeedTestOrg(): Promise<TestSeed> {
  const db = getTestPrisma();

  await db.organization.deleteMany({ where: { slug: TEST_ORG_SLUG } });

  const org = await db.organization.create({
    data: {
      name: TEST_ORG_NAME,
      slug: TEST_ORG_SLUG,
      plan: "BUSINESS",
      timezoneDefault: TEST_TIMEZONE,
      publicBookingEnabled: true,
      followUpEnabled: true,
      followUpHoursAfter: 2,
      reviewRequestEnabled: true,
      reviewRequestHoursAfter: 72,
      rebookingEnabled: true,
      rebookingDaysAfter: 14,
      reviewUrl: "https://example.test/review",
      locations: {
        create: {
          name: TEST_LOCATION_NAME,
          timezone: TEST_TIMEZONE,
        },
      },
    },
    include: { locations: true },
  });

  const locationId = org.locations[0]!.id;

  const resource = await db.resource.create({
    data: {
      organizationId: org.id,
      locationId,
      name: TEST_STAFF_NAME,
      type: "STAFF",
      rules: {
        create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          startMin: 9 * 60,
          endMin: 17 * 60,
        })),
      },
    },
  });

  const service = await db.service.create({
    data: {
      organizationId: org.id,
      name: TEST_SERVICE_NAME,
      durationMin: TEST_SERVICE_DURATION_MIN,
      bufferBefore: 0,
      bufferAfter: TEST_BUFFER_AFTER_MIN,
      priceCents: 3500,
      currency: "GBP",
    },
  });

  await db.serviceResource.create({
    data: { serviceId: service.id, resourceId: resource.id },
  });

  const client = await db.client.create({
    data: {
      organizationId: org.id,
      name: "Seeded Client",
      email: "seeded.client@example.test",
      marketingOptIn: true,
    },
  });

  const startAt = nextOpenSlotStart();
  const endAt = new Date(
    startAt.getTime() + TEST_SERVICE_DURATION_MIN * 60_000,
  );

  const booking = await db.booking.create({
    data: {
      organizationId: org.id,
      locationId,
      resourceId: resource.id,
      serviceId: service.id,
      clientId: client.id,
      startAt,
      endAt,
      status: "CONFIRMED",
      source: "PUBLIC",
      manageToken: TEST_MANAGE_TOKEN,
    },
  });

  return {
    organizationId: org.id,
    slug: org.slug,
    locationId,
    resourceId: resource.id,
    serviceId: service.id,
    manageToken: booking.manageToken,
    bookingId: booking.id,
  };
}

/** A weekday 10:00 UTC at least 2 days ahead so E2E always has later slots. */
export function nextOpenSlotStart(daysAhead = 3, hour = 10) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysAhead);
  start.setUTCHours(hour, 0, 0, 0);
  return start;
}

export async function findLatestBookingByEmail(email: string) {
  const db = getTestPrisma();
  return db.booking.findFirst({
    where: { client: { email } },
    orderBy: { createdAt: "desc" },
    include: { client: true, service: true, resource: true },
  });
}
