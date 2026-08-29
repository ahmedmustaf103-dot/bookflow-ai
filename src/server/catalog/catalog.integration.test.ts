import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { updateResource, updateService } from "@/server/catalog/catalog";
import { createBooking } from "@/server/bookings/service";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { disconnectTestPrisma, getTestPrisma } from "@/test/prisma";
import { resetAndSeedTestOrg, type TestSeed } from "@/test/seed";

async function otherOrg() {
  const db = getTestPrisma();
  await db.organization.deleteMany({ where: { slug: "phase6-other-shop" } });
  const org = await db.organization.create({
    data: {
      name: "Other Shop",
      slug: "phase6-other-shop",
      plan: "BUSINESS",
      timezoneDefault: "UTC",
      publicBookingEnabled: true,
      locations: { create: { name: "Other studio", timezone: "UTC" } },
    },
    include: { locations: true },
  });
  const locationId = org.locations[0]!.id;
  const resource = await db.resource.create({
    data: {
      organizationId: org.id,
      locationId,
      name: "Other Barber",
      type: "STAFF",
    },
  });
  const service = await db.service.create({
    data: {
      organizationId: org.id,
      name: "Other cut",
      durationMin: 30,
      priceCents: 1000,
      currency: "GBP",
    },
  });
  return {
    organizationId: org.id,
    serviceId: service.id,
    resourceId: resource.id,
  };
}

describe("catalog updates (DB)", () => {
  let seed: TestSeed;

  beforeEach(async () => {
    seed = await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    const db = getTestPrisma();
    await db.organization.deleteMany({ where: { slug: "phase6-other-shop" } });
    await disconnectTestPrisma();
  });

  it("lets an admin edit their own service price and duration", async () => {
    const result = await updateService({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      name: "Skin fade",
      description: "Clipper fade",
      durationMin: 45,
      priceCents: 4200,
      bufferBefore: 0,
      bufferAfter: 10,
      isActive: true,
      resourceIds: [seed.resourceId],
    });
    expect(result.ok).toBe(true);

    const db = getTestPrisma();
    const service = await db.service.findUnique({
      where: { id: seed.serviceId },
    });
    expect(service?.name).toBe("Skin fade");
    expect(service?.durationMin).toBe(45);
    expect(service?.priceCents).toBe(4200);
    expect(service?.bufferAfter).toBe(10);
    expect(service?.description).toBe("Clipper fade");
  });

  it("cannot edit another organization's service", async () => {
    const other = await otherOrg();
    const result = await updateService({
      organizationId: seed.organizationId,
      serviceId: other.serviceId,
      name: "Hijacked",
      description: null,
      durationMin: 15,
      priceCents: 1,
      bufferBefore: 0,
      bufferAfter: 0,
      isActive: true,
      resourceIds: [],
    });
    expect(result.ok).toBe(false);

    const db = getTestPrisma();
    const service = await db.service.findUnique({
      where: { id: other.serviceId },
    });
    expect(service?.name).toBe("Other cut");
  });

  it("hides a deactivated service from new public bookings and keeps history", async () => {
    const db = getTestPrisma();
    const existing = await db.booking.findUnique({
      where: { id: seed.bookingId },
    });
    expect(existing).toBeTruthy();

    const deactivated = await updateService({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      name: "Haircut",
      description: null,
      durationMin: 30,
      priceCents: 3500,
      bufferBefore: 0,
      bufferAfter: 15,
      isActive: false,
      resourceIds: [seed.resourceId],
    });
    expect(deactivated.ok).toBe(true);

    const stillThere = await db.booking.findUnique({
      where: { id: seed.bookingId },
    });
    expect(stillThere?.serviceId).toBe(seed.serviceId);

    await expect(
      getSlotsForServiceResource({
        organizationId: seed.organizationId,
        serviceId: seed.serviceId,
        resourceId: seed.resourceId,
      }),
    ).rejects.toThrow(/Service not found/i);

    const startAt = new Date();
    startAt.setUTCDate(startAt.getUTCDate() + 6);
    startAt.setUTCHours(11, 0, 0, 0);
    const booked = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt,
      client: { name: "Blocked", email: `blk+${Date.now()}@example.test` },
      source: "PUBLIC",
    });
    expect(booked.ok).toBe(false);
  });

  it("lets an admin rename staff and persist service assignments", async () => {
    const result = await updateResource({
      organizationId: seed.organizationId,
      resourceId: seed.resourceId,
      name: "Jamie Chen",
      isActive: true,
      serviceIds: [seed.serviceId],
    });
    expect(result.ok).toBe(true);

    const db = getTestPrisma();
    const resource = await db.resource.findUnique({
      where: { id: seed.resourceId },
      include: { services: true },
    });
    expect(resource?.name).toBe("Jamie Chen");
    expect(resource?.services.map((s) => s.serviceId)).toEqual([
      seed.serviceId,
    ]);
  });

  it("cannot edit another organization's staff", async () => {
    const other = await otherOrg();
    const result = await updateResource({
      organizationId: seed.organizationId,
      resourceId: other.resourceId,
      name: "Stolen",
      isActive: false,
      serviceIds: [],
    });
    expect(result.ok).toBe(false);

    const db = getTestPrisma();
    const resource = await db.resource.findUnique({
      where: { id: other.resourceId },
    });
    expect(resource?.name).toBe("Other Barber");
    expect(resource?.isActive).toBe(true);
  });

  it("links a team login to a chair and rejects someone outside the org", async () => {
    const db = getTestPrisma();
    const owner = await db.user.findUniqueOrThrow({
      where: { clerkUserId: "test-seed-owner" },
    });

    const linked = await updateResource({
      organizationId: seed.organizationId,
      resourceId: seed.resourceId,
      name: "Alex Rivera",
      isActive: true,
      serviceIds: [seed.serviceId],
      userId: owner.id,
    });
    expect(linked.ok).toBe(true);
    expect(
      (await db.resource.findUnique({ where: { id: seed.resourceId } }))
        ?.userId,
    ).toBe(owner.id);

    const outsider = await db.user.create({
      data: {
        clerkUserId: `outsider-${Date.now()}`,
        email: `out+${Date.now()}@example.test`,
      },
    });
    const rejected = await updateResource({
      organizationId: seed.organizationId,
      resourceId: seed.resourceId,
      name: "Alex Rivera",
      isActive: true,
      serviceIds: [seed.serviceId],
      userId: outsider.id,
    });
    expect(rejected.ok).toBe(false);
    expect(
      (await db.resource.findUnique({ where: { id: seed.resourceId } }))
        ?.userId,
    ).toBe(owner.id);
  });

  it("blocks new public bookings for inactive staff and keeps appointments", async () => {
    const db = getTestPrisma();
    const existing = await db.booking.findUnique({
      where: { id: seed.bookingId },
    });
    expect(existing?.resourceId).toBe(seed.resourceId);

    const deactivated = await updateResource({
      organizationId: seed.organizationId,
      resourceId: seed.resourceId,
      name: "Alex Rivera",
      isActive: false,
      serviceIds: [seed.serviceId],
    });
    expect(deactivated.ok).toBe(true);

    const stillThere = await db.booking.findUnique({
      where: { id: seed.bookingId },
    });
    expect(stillThere?.resourceId).toBe(seed.resourceId);

    const startAt = new Date();
    startAt.setUTCDate(startAt.getUTCDate() + 6);
    startAt.setUTCHours(11, 0, 0, 0);
    const booked = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt,
      client: { name: "Blocked", email: `stf+${Date.now()}@example.test` },
      source: "PUBLIC",
    });
    expect(booked.ok).toBe(false);
  });
});
