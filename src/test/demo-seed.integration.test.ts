import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_ORG_SLUG } from "@/test/constants";
import {
  assertDemoDatabaseAllowed,
  resetAndSeedDemoOrg,
} from "@/test/demo-seed";
import {
  DEMO_CLIENTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_ORG_SLUG,
  DEMO_TIMEZONE,
} from "@/test/demo-shop";
import { disconnectTestPrisma, getTestPrisma } from "@/test/prisma";
import { resetAndSeedTestOrg } from "@/test/seed";

const FROZEN_NOW = new Date("2026-08-12T12:00:00.000Z");

describe("demo org seed isolation", () => {
  beforeEach(async () => {
    await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("refuses hosted databases unless explicitly allowed", () => {
    expect(() =>
      assertDemoDatabaseAllowed("postgres://db.prisma.io/postgres", false),
    ).toThrow(/hosted/);
    expect(() =>
      assertDemoDatabaseAllowed("postgres://db.prisma.io/postgres", true),
    ).not.toThrow();
    expect(() =>
      assertDemoDatabaseAllowed(
        "postgres://127.0.0.1:54329/bookflow_test",
        false,
      ),
    ).not.toThrow();
  });

  it("reseeds only bookflow-demo and leaves the E2E org intact", async () => {
    const db = getTestPrisma();
    const demo = await resetAndSeedDemoOrg(db, { now: FROZEN_NOW });

    expect(demo.slug).toBe(DEMO_ORG_SLUG);
    expect(demo.bookingCount).toBeGreaterThan(20);

    const e2e = await db.organization.findUnique({
      where: { slug: TEST_ORG_SLUG },
    });
    expect(e2e).toBeTruthy();

    const liveSlugs = await db.organization.findMany({
      where: { slug: { in: ["bookflow", "pgym"] } },
    });
    expect(liveSlugs).toHaveLength(0);

    const clients = await db.client.findMany({
      where: { organizationId: demo.organizationId },
    });
    expect(clients).toHaveLength(DEMO_CLIENTS.length);
    expect(
      clients.every((c) => c.email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`)),
    ).toBe(true);
    expect(clients.some((c) => c.marketingOptIn)).toBe(true);
    expect(clients.some((c) => !c.marketingOptIn)).toBe(true);

    const bookings = await db.booking.findMany({
      where: { organizationId: demo.organizationId },
      include: { service: true, resource: true, client: true },
    });
    expect(bookings).toHaveLength(demo.bookingCount);

    const byStatus = bookings.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    expect(byStatus.COMPLETED ?? 0).toBeGreaterThanOrEqual(8);
    expect(byStatus.CONFIRMED ?? 0).toBeGreaterThanOrEqual(5);
    expect(byStatus.CANCELLED ?? 0).toBeGreaterThanOrEqual(2);
    expect(byStatus.NO_SHOW ?? 0).toBeGreaterThanOrEqual(2);
    expect(byStatus.PENDING ?? 0).toBeGreaterThanOrEqual(1);

    expect(new Set(bookings.map((b) => b.resource.name)).size).toBe(4);
    expect(
      new Set(bookings.map((b) => b.service.name)).size,
    ).toBeGreaterThanOrEqual(4);

    const completedRevenue = bookings
      .filter((b) => b.status === "COMPLETED")
      .reduce((sum, b) => sum + b.service.priceCents, 0);
    expect(completedRevenue).toBeGreaterThan(20_000);

    const services = await db.service.findMany({
      where: { organizationId: demo.organizationId },
    });
    expect(services).toHaveLength(6);

    const staffMemberships = await db.membership.count({
      where: { organizationId: demo.organizationId, role: "STAFF" },
    });
    expect(staffMemberships).toBe(4);

    const alex = clients.find((c) => c.email === "alex.morgan@example.test");
    expect(alex).toBeTruthy();
    const alexVisits = bookings.filter((b) => b.clientId === alex!.id);
    expect(alexVisits.length).toBeGreaterThanOrEqual(5);
    expect(
      alexVisits.filter((b) => b.service.name === "Skin Fade").length,
    ).toBeGreaterThanOrEqual(5);

    const newClientCutoff = new Date(
      FROZEN_NOW.getTime() - 30 * 24 * 60 * 60_000,
    );
    expect(clients.some((c) => c.createdAt >= newClientCutoff)).toBe(true);
    expect(clients.some((c) => c.createdAt < newClientCutoff)).toBe(true);

    const location = await db.location.findUnique({
      where: { id: demo.locationId },
    });
    expect(location?.timezone).toBe(DEMO_TIMEZONE);
  });
});
