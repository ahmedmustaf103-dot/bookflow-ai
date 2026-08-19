import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { OUTBOX_KINDS } from "@/server/notifications/kinds";
import { enqueueOwnerNewBooking } from "@/server/notifications/outbox";
import { createBooking, transitionBooking } from "@/server/bookings/service";
import { getSlotsForServiceResource } from "@/server/availability/slots";
import { disconnectTestPrisma, getTestPrisma } from "@/test/prisma";
import { resetAndSeedTestOrg, type TestSeed } from "@/test/seed";

describe("booking reliability (DB)", () => {
  let seed: TestSeed;

  beforeEach(async () => {
    seed = await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  async function openSlots() {
    return getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      requireLink: true,
    });
  }

  it("creates a booking and lists it in the calendar query window", async () => {
    const slots = await openSlots();
    const start = slots.find((s) => s.start.getUTCHours() >= 11);
    expect(start).toBeTruthy();

    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start!.start,
      client: {
        name: "Calendar Client",
        email: `cal+${Date.now()}@example.test`,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const rows = await db.booking.findMany({
      where: {
        organizationId: seed.organizationId,
        startAt: {
          gte: start!.start,
          lt: new Date(start!.start.getTime() + 60 * 60_000),
        },
        status: { not: "CANCELLED" },
      },
      include: { client: true, service: true },
    });
    expect(rows.some((b) => b.id === created.data.bookingId)).toBe(true);
    expect(rows.some((b) => b.client.name === "Calendar Client")).toBe(true);
    expect(rows.some((b) => b.service.name === "Haircut")).toBe(true);
  });

  it("creates a dashboard-source booking that appears on the calendar and client history", async () => {
    const slots = await openSlots();
    const start = slots.find((s) => s.start.getUTCHours() >= 12);
    expect(start).toBeTruthy();

    const email = `walkin+${Date.now()}@example.test`;
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start!.start,
      client: {
        name: "Walk In",
        email,
        notes: "Phone booking",
      },
      source: "DASHBOARD",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const booking = await db.booking.findFirst({
      where: {
        id: created.data.bookingId,
        organizationId: seed.organizationId,
      },
      include: { client: true },
    });
    expect(booking?.source).toBe("DASHBOARD");
    expect(booking?.status).toBe("CONFIRMED");
    expect(booking?.client.email).toBe(email);

    const history = await db.booking.findMany({
      where: {
        organizationId: seed.organizationId,
        clientId: booking!.clientId,
      },
    });
    expect(history.some((b) => b.id === booking!.id)).toBe(true);

    const kinds = (
      await db.notificationOutbox.findMany({
        where: { bookingId: booking!.id },
      })
    ).map((r) => r.kind);
    expect(kinds).toContain(OUTBOX_KINDS.BOOKING_CONFIRMATION);
    expect(kinds).toContain(OUTBOX_KINDS.BOOKING_CREATED);
  });

  it("rejects a dashboard double-book of the same slot", async () => {
    const slots = await openSlots();
    const start = slots.find((s) => s.start.getUTCHours() >= 13);
    expect(start).toBeTruthy();

    const first = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start!.start,
      client: { name: "Dash A", email: `da+${Date.now()}@example.test` },
      source: "DASHBOARD",
    });
    expect(first.ok).toBe(true);

    const second = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start!.start,
      client: { name: "Dash B", email: `db+${Date.now()}@example.test` },
      source: "DASHBOARD",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error).toMatch(
        /just booked|no longer available|taken|conflict/i,
      );
    }
  });

  it("applies buffer rules to dashboard bookings", async () => {
    const startAt = new Date();
    startAt.setUTCDate(startAt.getUTCDate() + 5);
    startAt.setUTCHours(9, 0, 0, 0);
    const blocked = new Date(startAt.getTime() + 30 * 60_000);
    const afterBuffer = new Date(startAt.getTime() + 60 * 60_000);

    const first = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt,
      client: { name: "Dash Buffer", email: `dbuf+${Date.now()}@example.test` },
      source: "DASHBOARD",
    });
    expect(first.ok).toBe(true);

    const adjacent = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: blocked,
      client: {
        name: "Dash Adjacent",
        email: `dadj+${Date.now()}@example.test`,
      },
      source: "DASHBOARD",
    });
    expect(adjacent.ok).toBe(false);

    const later = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: afterBuffer,
      client: {
        name: "Dash After buffer",
        email: `dlater+${Date.now()}@example.test`,
      },
      source: "DASHBOARD",
    });
    expect(later.ok).toBe(true);
  });

  it("rejects a double-book of the same slot", async () => {
    const slots = await openSlots();
    const start = slots[0];
    expect(start).toBeTruthy();

    const [a, b] = await Promise.all([
      createBooking({
        organizationId: seed.organizationId,
        serviceId: seed.serviceId,
        resourceId: seed.resourceId,
        startAt: start.start,
        client: { name: "A", email: `a+${Date.now()}@example.test` },
        source: "PUBLIC",
        idempotencyKey: `race-a-${Date.now()}`,
      }),
      createBooking({
        organizationId: seed.organizationId,
        serviceId: seed.serviceId,
        resourceId: seed.resourceId,
        startAt: start.start,
        client: { name: "B", email: `b+${Date.now()}@example.test` },
        source: "PUBLIC",
        idempotencyKey: `race-b-${Date.now()}`,
      }),
    ]);

    const oks = [a, b].filter((r) => r.ok);
    const fails = [a, b].filter((r) => !r.ok);
    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    if (!fails[0]!.ok) {
      expect(fails[0].error).toMatch(
        /just booked|no longer available|taken|conflict/i,
      );
    }
  });

  it("enforces buffers so the next adjacent slot cannot be booked", async () => {
    // Haircut is 30 min + 15 min bufferAfter. Book 09:00 on a clean day
    // (seed occupies +3d 10:00). 09:30 overlaps the buffer; 10:00 does not.
    const startAt = new Date();
    startAt.setUTCDate(startAt.getUTCDate() + 5);
    startAt.setUTCHours(9, 0, 0, 0);
    const blocked = new Date(startAt.getTime() + 30 * 60_000);
    const afterBuffer = new Date(startAt.getTime() + 60 * 60_000);

    const first = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt,
      client: { name: "Buffer", email: `buf+${Date.now()}@example.test` },
      source: "PUBLIC",
    });
    expect(first.ok).toBe(true);

    const adjacent = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: blocked,
      client: { name: "Adjacent", email: `adj+${Date.now()}@example.test` },
      source: "PUBLIC",
    });
    expect(adjacent.ok).toBe(false);

    const later = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: afterBuffer,
      client: {
        name: "After buffer",
        email: `later+${Date.now()}@example.test`,
      },
      source: "PUBLIC",
    });
    expect(later.ok).toBe(true);
  });

  it("frees the slot after cancel so the same time can be rebooked", async () => {
    const slots = await openSlots();
    const start = slots[0];
    const email = `rebook+${Date.now()}@example.test`;

    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start.start,
      client: { name: "Rebook", email },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const cancelled = await transitionBooking({
      organizationId: seed.organizationId,
      bookingId: created.data.bookingId,
      to: "CANCELLED",
      cancelReason: "test",
    });
    expect(cancelled.ok).toBe(true);

    const again = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start.start,
      client: {
        name: "Rebook Two",
        email: `rebook2+${Date.now()}@example.test`,
      },
      source: "PUBLIC",
    });
    expect(again.ok).toBe(true);
  });

  it("returns the same booking for a duplicate idempotency key", async () => {
    const slots = await openSlots();
    const key = `idem-${Date.now()}`;
    const input = {
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: slots[0].start,
      client: { name: "Idem", email: `idem+${Date.now()}@example.test` },
      source: "PUBLIC" as const,
      idempotencyKey: key,
    };
    const first = await createBooking(input);
    const second = await createBooking(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data.bookingId).toBe(first.data.bookingId);
    }
  });
});

describe("outbox + automation (DB)", () => {
  let seed: TestSeed;

  beforeEach(async () => {
    seed = await resetAndSeedTestOrg();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("enqueues confirmation, reminder, and owner notify when a booking is created", async () => {
    const slots = await getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
    });
    // Reminders are skipped when startAt - reminderHoursBefore is already past.
    const reminderHours = 24;
    const start = slots.find(
      (s) =>
        s.start.getTime() - reminderHours * 60 * 60 * 1000 >
        Date.now() + 60_000,
    );
    expect(start).toBeTruthy();

    const clientEmail = `notify+${Date.now()}@example.test`;
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: start!.start,
      client: {
        name: "Notify Me",
        email: clientEmail,
        marketingOptIn: false,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const rows = await db.notificationOutbox.findMany({
      where: { bookingId: created.data.bookingId },
    });
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toContain(OUTBOX_KINDS.BOOKING_CONFIRMATION);
    expect(kinds).toContain(OUTBOX_KINDS.BOOKING_REMINDER);
    expect(kinds).toContain(OUTBOX_KINDS.BOOKING_CREATED);
    expect(kinds).not.toContain(OUTBOX_KINDS.FOLLOW_UP);

    const confirmation = rows.find(
      (r) => r.kind === OUTBOX_KINDS.BOOKING_CONFIRMATION,
    );
    const reminder = rows.find((r) => r.kind === OUTBOX_KINDS.BOOKING_REMINDER);
    const ownerRow = rows.find((r) => r.kind === OUTBOX_KINDS.BOOKING_CREATED);
    expect(confirmation).toBeTruthy();
    expect(reminder).toBeTruthy();
    expect(ownerRow).toBeTruthy();
    expect(ownerRow!.toAddress).toBe(seed.ownerEmail);
    expect(ownerRow!.toAddress).not.toBe(clientEmail);
    expect(ownerRow!.dedupeKey).toBe(
      `BOOKING_CREATED:${created.data.bookingId}:EMAIL:${seed.ownerEmail}`,
    );
    // Confirmation + owner notify are due immediately and flushed via after().
    // Tests have no email provider, so the row may already be claimed.
    expect(["PENDING", "PROCESSING", "SENT", "FAILED"]).toContain(
      ownerRow!.status,
    );
    expect(["PENDING", "PROCESSING", "SENT", "FAILED"]).toContain(
      confirmation!.status,
    );
    expect(confirmation!.toAddress).toBe(clientEmail);
    expect(reminder!.status).toBe("PENDING");
    const expectedReminderAt =
      start!.start.getTime() - reminderHours * 60 * 60 * 1000;
    expect(
      Math.abs(reminder!.scheduledFor.getTime() - expectedReminderAt),
    ).toBeLessThan(2_000);
    expect(reminder!.scheduledFor.getTime()).toBeGreaterThan(Date.now());
  });

  it("enqueues cancellation outbox when a booking is cancelled", async () => {
    const slots = await getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
    });
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: slots[0]!.start,
      client: {
        name: "Cancel Me",
        email: `cancel+${Date.now()}@example.test`,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await transitionBooking({
      organizationId: seed.organizationId,
      bookingId: created.data.bookingId,
      to: "CANCELLED",
      cancelReason: "customer",
    });

    const db = getTestPrisma();
    const rows = await db.notificationOutbox.findMany({
      where: {
        bookingId: created.data.bookingId,
        kind: OUTBOX_KINDS.BOOKING_CANCELLATION,
      },
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("enqueues follow-up, review, and rebooking when opted-in visit is completed", async () => {
    const slots = await getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
    });
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: slots[0]!.start,
      client: {
        name: "Opted In",
        email: `optin+${Date.now()}@example.test`,
        marketingOptIn: true,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const completed = await transitionBooking({
      organizationId: seed.organizationId,
      bookingId: created.data.bookingId,
      to: "COMPLETED",
    });
    expect(completed.ok).toBe(true);

    const db = getTestPrisma();
    const rows = await db.notificationOutbox.findMany({
      where: { bookingId: created.data.bookingId },
    });
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toContain(OUTBOX_KINDS.FOLLOW_UP);
    expect(kinds).toContain(OUTBOX_KINDS.REVIEW_REQUEST);
    expect(kinds).toContain(OUTBOX_KINDS.REBOOKING_REMINDER);
  });

  it("does not enqueue marketing rows when marketingOptIn is false", async () => {
    const slots = await getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
    });
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: slots[0]!.start,
      client: {
        name: "Opted Out",
        email: `optout+${Date.now()}@example.test`,
        marketingOptIn: false,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await transitionBooking({
      organizationId: seed.organizationId,
      bookingId: created.data.bookingId,
      to: "COMPLETED",
    });

    const db = getTestPrisma();
    const rows = await db.notificationOutbox.findMany({
      where: {
        bookingId: created.data.bookingId,
        kind: {
          in: [
            OUTBOX_KINDS.FOLLOW_UP,
            OUTBOX_KINDS.REVIEW_REQUEST,
            OUTBOX_KINDS.REBOOKING_REMINDER,
          ],
        },
      },
    });
    expect(rows).toHaveLength(0);

    const transactional = await db.notificationOutbox.findMany({
      where: {
        bookingId: created.data.bookingId,
        kind: {
          in: [OUTBOX_KINDS.BOOKING_CONFIRMATION, OUTBOX_KINDS.BOOKING_CREATED],
        },
      },
    });
    expect(
      transactional.some((r) => r.kind === OUTBOX_KINDS.BOOKING_CONFIRMATION),
    ).toBe(true);
    const ownerRow = transactional.find(
      (r) => r.kind === OUTBOX_KINDS.BOOKING_CREATED,
    );
    expect(ownerRow).toBeTruthy();
    expect(ownerRow!.toAddress).toBe(seed.ownerEmail);
  });

  it("does not enqueue a second owner notify for the same booking", async () => {
    const slots = await getSlotsForServiceResource({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
    });
    const created = await createBooking({
      organizationId: seed.organizationId,
      serviceId: seed.serviceId,
      resourceId: seed.resourceId,
      startAt: slots[0]!.start,
      client: {
        name: "Dedupe Me",
        email: `dedupe+${Date.now()}@example.test`,
        marketingOptIn: false,
      },
      source: "PUBLIC",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const db = getTestPrisma();
    const booking = await db.booking.findFirstOrThrow({
      where: { id: created.data.bookingId },
      include: {
        organization: true,
        client: true,
        service: true,
        resource: true,
        location: true,
      },
    });

    await enqueueOwnerNewBooking({
      organizationId: booking.organizationId,
      organizationName: booking.organization.name,
      organizationSlug: booking.organization.slug,
      plan: booking.organization.plan,
      bookingId: booking.id,
      manageToken: booking.manageToken,
      startAt: booking.startAt,
      endAt: booking.endAt,
      timezone: booking.location.timezone,
      clientName: booking.client.name,
      clientEmail: booking.client.email,
      marketingOptIn: booking.client.marketingOptIn,
      serviceName: booking.service.name,
      resourceName: booking.resource.name,
      priceCents: booking.service.priceCents,
      currency: booking.service.currency,
    });

    const ownerRows = await db.notificationOutbox.findMany({
      where: {
        bookingId: created.data.bookingId,
        kind: OUTBOX_KINDS.BOOKING_CREATED,
      },
    });
    expect(ownerRows).toHaveLength(1);
  });
});
