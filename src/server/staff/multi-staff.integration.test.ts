import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createBooking } from "@/server/bookings/service";
import { OUTBOX_KINDS } from "@/server/notifications/kinds";
import {
  bookingWhereForScope,
  resolveStaffResourceScope,
} from "@/server/staff/scope";
import { TEST_OWNER_CLERK_ID } from "@/test/constants";
import { disconnectTestPrisma, getTestPrisma } from "@/test/prisma";
import { resetAndSeedTestOrg, nextOpenSlotStart, type TestSeed } from "@/test/seed";

describe("multi-staff isolation (DB)", () => {
  let seed: TestSeed;

  beforeEach(async () => {
    seed = await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("keeps five staff calendars and notifications on the same organization", async () => {
    const db = getTestPrisma();
    const owner = await db.user.findUniqueOrThrow({
      where: { clerkUserId: TEST_OWNER_CLERK_ID },
    });

    const staff = [];
    for (let i = 1; i <= 5; i += 1) {
      const user = await db.user.create({
        data: {
          clerkUserId: `multi-staff-${seed.organizationId}-${i}`,
          email: `barber${i}@salon.test`,
          firstName: `Barber`,
          lastName: `${i}`,
        },
      });
      await db.membership.create({
        data: {
          organizationId: seed.organizationId,
          userId: user.id,
          role: "STAFF",
          status: "ACTIVE",
        },
      });
      const resource = await db.resource.create({
        data: {
          organizationId: seed.organizationId,
          locationId: seed.locationId,
          name: `Barber ${i}`,
          type: "STAFF",
          userId: user.id,
          rules: {
            create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              startMin: 9 * 60,
              endMin: 17 * 60,
            })),
          },
        },
      });
      await db.serviceResource.create({
        data: { serviceId: seed.serviceId, resourceId: resource.id },
      });
      staff.push({ user, resource });
    }

    const startAt = nextOpenSlotStart(8, 11);

    const booked = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: staff[0]!.resource.id,
      startAt,
      client: {
        name: "Salon Guest",
        email: `guest+${Date.now()}@example.test`,
      },
      source: "PUBLIC",
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;

    const ownerScope = await resolveStaffResourceScope({
      organizationId: seed.organizationId,
      userId: owner.id,
      role: "OWNER",
    });
    const staff1Scope = await resolveStaffResourceScope({
      organizationId: seed.organizationId,
      userId: staff[0]!.user.id,
      role: "STAFF",
    });
    const staff2Scope = await resolveStaffResourceScope({
      organizationId: seed.organizationId,
      userId: staff[1]!.user.id,
      role: "STAFF",
    });

    expect(ownerScope).toEqual({ all: true });
    expect(staff1Scope).toEqual({
      all: false,
      resourceIds: [staff[0]!.resource.id],
    });
    expect(staff2Scope).toEqual({
      all: false,
      resourceIds: [staff[1]!.resource.id],
    });

    const visibleTo1 = await db.booking.findMany({
      where: {
        organizationId: seed.organizationId,
        id: booked.data.bookingId,
        ...bookingWhereForScope(staff1Scope),
      },
    });
    const visibleTo2 = await db.booking.findMany({
      where: {
        organizationId: seed.organizationId,
        id: booked.data.bookingId,
        ...bookingWhereForScope(staff2Scope),
      },
    });
    const visibleToOwner = await db.booking.findMany({
      where: {
        organizationId: seed.organizationId,
        id: booked.data.bookingId,
        ...bookingWhereForScope(ownerScope),
      },
    });
    expect(visibleTo1).toHaveLength(1);
    expect(visibleTo2).toHaveLength(0);
    expect(visibleToOwner).toHaveLength(1);

    const createdRows = await db.notificationOutbox.findMany({
      where: {
        bookingId: booked.data.bookingId,
        kind: OUTBOX_KINDS.BOOKING_CREATED,
      },
    });
    const addresses = createdRows.map((row) => row.toAddress).sort();
    expect(addresses).toContain("barber1@salon.test");
    expect(addresses).toContain(seed.ownerEmail);
    expect(addresses).not.toContain("barber2@salon.test");
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});
